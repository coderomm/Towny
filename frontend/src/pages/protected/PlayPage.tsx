import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, MessageCircle, Settings, X, AlignJustify, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { ArenaMap } from '../../components/ui/ArenaMap';
import PageWrapper from '../../components/ui/PageWrapper';

const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C'
];

interface UserRes {
    id: string;
    x: number;
    y: number;
    color?: string;
}

const PlayPage = () => {
    const [searchParams] = useSearchParams();
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const wsRef = useRef<WebSocket | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const positionRef = useRef({ x: 0, y: 0 });
    const [currentUser, setCurrentUser] = useState<{ x: number, y: number, userId: string }>({ x: 0, y: 0, userId: '' });
    const [users, setUsers] = useState<Map<string, UserRes>>(new Map());
    const [showUsers, setShowUsers] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [space, setSpace] = useState<{
        creatorId: string,
        height: number,
        id: string,
        mapId?: string,
        name: string,
        thumbnail?: string,
        width: number
    }>({
        creatorId: '',
        height: 0,
        id: '',
        mapId: '',
        name: '',
        thumbnail: '',
        width: 0
    });

    const handleUserUpdate = useCallback((userId: string, userData: Partial<UserRes>) => {
        setUsers(prev => {
            const newUsers = new Map(prev);
            const existingUser = newUsers.get(userId);
            if (existingUser) {
                newUsers.set(userId, { ...existingUser, ...userData });
            } else {
                newUsers.set(userId, {
                    id: userId,
                    x: 0,
                    y: 0,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    ...userData
                });
            }
            return newUsers;
        });
    }, []);

    const initializeWebSocket = useCallback((spaceId: string, token: string) => {
        const socket = new WebSocket(import.meta.env.VITE_WS_URL);

        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: 'join',
                payload: { spaceId, token }
            }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'space-joined': {
                    const { spawn, userId, users: initialUsers, space: spaceData } = data.payload;
                    setCurrentUser({ x: spawn.x, y: spawn.y, userId });
                    setPosition(spawn);
                    positionRef.current = spawn;

                    const userMap = new Map();
                    initialUsers.forEach((user: UserRes) => {
                        userMap.set(user.id, {
                            ...user,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        });
                    });
                    setUsers(userMap);
                    setSpace(spaceData);
                    break;
                }

                case 'user-joined': {
                    const { userId, x, y } = data.payload;
                    handleUserUpdate(userId, { x, y });
                    break;
                }

                case 'movement': {
                    const { userId, x, y } = data.payload;
                    handleUserUpdate(userId, { x, y });
                    break;
                }

                case 'movement-rejected': {
                    const { x, y } = data.payload;
                    setPosition({ x, y });
                    positionRef.current = { x, y };
                    setCurrentUser(prev => ({ ...prev, x, y }));
                    break;
                }

                case 'user-left': {
                    const { userId } = data.payload;
                    setUsers(prev => {
                        const newUsers = new Map(prev);
                        newUsers.delete(userId);
                        return newUsers;
                    });
                    break;
                }
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            toast.error('Connection error occurred');
        };

        socket.onclose = () => {
            toast.error('Connection closed');
        };

        wsRef.current = socket;
        return socket;
    }, [handleUserUpdate]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/accounts/signin');
            return;
        }

        const spaceId = searchParams.get('spaceId');
        if (!spaceId) {
            navigate('/home/spaces');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('User token not found');
            return;
        }

        const socket = initializeWebSocket(spaceId, token);

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };
    }, [isAuthenticated, navigate, searchParams, initializeWebSocket]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            if (!currentUser.userId) return;

            let newX = positionRef.current.x;
            let newY = positionRef.current.y;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                    if (newY > 0) newY--;
                    break;
                case 'ArrowDown':
                case 's':
                    if (newY < space.height - 1) newY++;
                    break;
                case 'ArrowLeft':
                case 'a':
                    if (newX > 0) newX--;
                    break;
                case 'ArrowRight':
                case 'd':
                    if (newX < space.width - 1) newX++;
                    break;
                default:
                    return;
            }

            if (newX !== positionRef.current.x || newY !== positionRef.current.y) {
                positionRef.current = { x: newX, y: newY };
                setPosition({ x: newX, y: newY });

                wsRef.current.send(
                    JSON.stringify({
                        type: 'move',
                        payload: { x: newX, y: newY },
                    })
                );
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [space.height, space.width, currentUser.userId]);

    const handleSideMenuBar = () => {
        if (showUsers) {
            setShowUsers(!showUsers)
            setShowSideMenu(!showSideMenu)
        } else {
            setShowSideMenu(!showSideMenu)
        }
    }
    const handleShowUserBar = () => {
        if (showSideMenu) {
            setShowSideMenu(!showSideMenu)
            setShowUsers(!showUsers)
        } else {
            setShowUsers(!showUsers)
        }
    }
    return (
        <PageWrapper>
            {/* Side Bar */}
            <aside className="fixed top-0 left-0 bottom-0 border-b z-10 pointer-events-auto flex h-full w-[48px] flex-col border-r border-gray-200 bg-gray-50">
                <section className="flex flex-col items-center w-full pb-[10px] pt-[16px]">
                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={handleSideMenuBar}
                            className={`p-2 hover:bg-gray-200 rounded-full ${showSideMenu ? 'bg-gray-200' : ''}`}
                        >
                            <AlignJustify className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleShowUserBar}
                            className={`p-2 hover:bg-gray-200 rounded-full ${showUsers ? 'bg-gray-200' : ''}`}
                        >
                            <Users className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded-full">
                            <MessageCircle className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded-full">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </section>
            </aside>
            <div className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] bg-white border-l shadow-lg"></div>

            {/* Game Area */}
            <div className="relative w-[calc(100%-48px)] h-screen bg-black border border-gray-700 overflow-hidden cursor-move ms-[48px]">
                <ArenaMap
                    width={space.width || 100}
                    height={space.height || 100}
                    playerPosition={position}
                    users={users}
                />
            </div>

            {showUsers && (
                <div className="fixed top-0 left-[48px] w-[calc(100%-90px)] sm:max-w-xs lg:w-full h-full bg-white border-l shadow-lg">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="font-semibold">Users in Space</h2>
                        <button
                            onClick={() => setShowUsers(false)}
                            className="p-1 hover:bg-gray-100 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-primary rounded-full" />
                            <span className="font-medium">You</span>
                        </div>
                        {Array.from(users.values()).map((user) => (
                            <div key={user.id} className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-8 h-8 rounded-full"
                                    style={{ backgroundColor: user.color }}
                                />
                                <span>User {user.id.slice(0, 4)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showSideMenu && (
                <div className="fixed top-0 left-[48px] w-[calc(100%-90px)] sm:max-w-xs lg:w-full h-full bg-white border-l shadow-lg">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="font-semibold">Welcome</h2>
                        <button
                            onClick={() => setShowSideMenu(false)}
                            className="p-1 hover:bg-gray-100 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center justify-start gap-2 px-4 py-2 border-b">
                        <img src={user?.imageUrl} className="w-10 h-10 rounded-full shadow-2xl shadow-primary" alt="User" />
                        <p className="text-base text-primary">{user?.email} | <span className='text-gray-950'>{user?.role === 'Admin' ? user.role : ''}</span></p>
                    </div>
                    <button
                        onClick={() => navigate('/home/spaces')}
                        className="hover:bg-gray-100 w-full flex items-center justify-start gap-2 px-4 py-2 border-b"
                    >
                        <LogOut className="w-5 h-5" /> Exit Space
                    </button>
                </div>
            )}
        </PageWrapper>
    );
};

export default PlayPage;