import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Users, MessageCircle, Settings, X, AlignJustify } from 'lucide-react';
import { toast } from 'sonner';
import PlayMap from '../../components/ui/Map';

const TILE_SIZE = 32;    // Size of each movement tile
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
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [token, setToken] = useState<string>('');
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const positionRef = useRef({ x: 0, y: 0 });
    const [users, setUsers] = useState<Map<string, UserRes>>(new Map());
    const [showUsers, setShowUsers] = useState(false);
    const [space, setSpace] = useState<{
        creatorId: string,
        height: number,
        id: string,
        mapId?: string,
        name: string,
        thumbnail?: string,
        width: number
    }>()

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/signin');
            return;
        }

        const spaceId = searchParams.get('spaceId');
        if (!spaceId) {
            navigate('/home/spaces');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('User token not found')
            return
        }
        setToken(token);

        const socket = new WebSocket('ws://localhost:3001');
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: 'join',
                payload: {
                    spaceId,
                    token
                }
            }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'space-joined': {
                    setPosition(data.payload.spawn);
                    positionRef.current = data.payload.spawn;
                    const userMap = new Map<string, UserRes>();
                    data.payload.users.forEach((user: UserRes) => {
                        userMap.set(user.id, {
                            ...user,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)]
                        });
                    });
                    setUsers(userMap);
                    console.log("space data = ", data.payload.space)
                    setSpace(data.payload.space)
                    console.log("space state data = ", space)
                    break;
                }

                case 'user-joined': {
                    setUsers((prev) => {
                        const newUsers = new Map(prev);
                        newUsers.set(data.payload.userId, {
                            id: data.payload.userId,
                            x: data.payload.x,
                            y: data.payload.y,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)]
                        });
                        return newUsers;
                    });
                    break;
                }

                case 'user-left': {
                    setUsers((prev) => {
                        const newUsers = new Map(prev);
                        newUsers.delete(data.payload.userId);
                        return newUsers;
                    });
                    break;
                }

                case 'movement': {
                    setUsers((prev) => {
                        const newUsers = new Map(prev);
                        const user = newUsers.get(data.payload.userId);
                        if (user) {
                            user.x = data.payload.x;
                            user.y = data.payload.y;
                        }
                        return newUsers;
                    });
                    break;
                }

                case 'movement-rejected': {
                    setPosition({
                        x: data.payload.x,
                        y: data.payload.y
                    });
                    positionRef.current = {
                        x: data.payload.x,
                        y: data.payload.y,
                    };
                    break;
                }

                default:
                    console.warn('Unhandled WebSocket message:', data);
                    toast.info('Unhandled WebSocket message:' + data);
            }
        };

        setWs(socket);

        return () => {
            socket.close();
        };
    }, [isAuthenticated, navigate, searchParams, token]);

    // Handle keyboard movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!ws) return;

            // let newX = position.x;
            // let newY = position.y;
            let newX = positionRef.current.x;
            let newY = positionRef.current.y;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                    newY--;
                    break;
                case 'ArrowDown':
                case 's':
                    newY++;
                    break;
                case 'ArrowLeft':
                case 'a':
                    newX--;
                    break;
                case 'ArrowRight':
                case 'd':
                    newX++;
                    break;
                default:
                    return;
            }

            positionRef.current = { x: newX, y: newY };
            setPosition({ x: newX, y: newY });

            ws.send(JSON.stringify({
                type: 'move',
                payload: { x: newX, y: newY }
            }));
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ws, position]);

    const handleBack = () => {
        navigate('/home/spaces');
    };

    return (
        <div className="min-h-dvh bg-gray-50">
            {/* Top Bar */}
            <aside className="fixed top-0 left-0 bottom-0 border-b z-10 pointer-events-auto flex h-full w-[48px] flex-col border-r border-gray-200 bg-gray-50">
                <section className="flex flex-col items-center w-full pb-[10px] pt-[16px]">
                    <button><AlignJustify className="w-5 h-5" /></button>
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={() => setShowUsers(!showUsers)}
                            className="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <Users className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <MessageCircle className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </section>
            </aside>
            <div className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] bg-white border-l shadow-lg"></div>

            {/* Game Area */}
            <div className="pt-16 px-4">
                <div className="relative w-full h-[100vh] bg-black rounded-lg border border-gray-700 overflow-hidden cursor-move">
                    {/* Current User */}
                    <div
                        className="absolute w-8 h-8 bg-purple-600 rounded-full transition-all duration-200 ease-in-out"
                        style={{
                            transform: `translate(${position.x * TILE_SIZE}px, ${position.y * TILE_SIZE}px)`
                        }}
                    />
                    <PlayMap size={{ width: 100, height: 100 }} />

                    {/* Other Users */}
                    {Array.from(users.values()).map((user) => (
                        <div
                            key={user.id}
                            className="absolute w-8 h-8 rounded-full transition-all duration-200 ease-in-out"
                            style={{
                                transform: `translate(${user.x * TILE_SIZE}px, ${user.y * TILE_SIZE}px)`,
                                backgroundColor: user.color
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Users Sidebar */}
            {showUsers && (
                <div className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] bg-white border-l shadow-lg">
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
                            <div className="w-8 h-8 bg-purple-600 rounded-full" />
                            <span className="font-medium">You</span>
                        </div>
                        {Array.from(users.values()).map((user) => (
                            <div key={user.id} className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-8 h-8 rounded-full"
                                    style={{ backgroundColor: user.color }}
                                />
                                <span>User {user.id.slice(0, 6)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayPage;