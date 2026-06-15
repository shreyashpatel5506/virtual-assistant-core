import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../Context/usercontext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '../utils/axiosInstance';
import { 
    ArrowLeft, 
    Search, 
    Clock, 
    ChevronLeft, 
    ChevronRight, 
    Loader,
    Calendar,
    Music,
    Calculator,
    CloudSun,
    MapPin,
    Image as ImageIcon,
    FileText,
    MessageSquare,
    Play,
    Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const History = () => {
    const { users } = useContext(UserContext);
    const navigate = useNavigate();

    // State
    const [historyList, setHistoryList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debounceSearch, setDebounceSearch] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
    });

    // Handle search debouncing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounceSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 })); // reset to page 1 on search
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch history logs
    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/auth/history', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debounceSearch
                }
            });
            if (response.data.success) {
                setHistoryList(response.data.histories || []);
                setPagination(response.data.pagination || {
                    page: 1,
                    limit: 10,
                    total: 0,
                    pages: 1
                });
            } else {
                toast.error('Failed to retrieve history');
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error(error.response?.data?.message || 'Error fetching history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [pagination.page, debounceSearch]);

    // Helper to parse history action string
    const parseAction = (action = '') => {
        const parts = action.split(' | ');
        let userMsg = '';
        let assistantRes = '';
        let type = '';

        parts.forEach(part => {
            if (part.startsWith('User: ')) {
                userMsg = part.substring(6);
            } else if (part.startsWith('Assistant: ')) {
                assistantRes = part.substring(11);
            } else if (part.startsWith('Type: ')) {
                type = part.substring(6);
            }
        });

        if (userMsg || assistantRes) {
            return { isConversation: true, userMsg, assistantRes, type };
        }
        return { isConversation: false, rawText: action };
    };

    // Map action type to Lucide Icon
    const getTypeIcon = (type = '') => {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('search') && lowerType.includes('youtube')) return <Play size={14} className="text-red-400" />;
        if (lowerType.includes('search')) return <Search size={14} className="text-cyan-400" />;
        if (lowerType.includes('spotify') || lowerType.includes('play')) return <Music size={14} className="text-green-400" />;
        if (lowerType.includes('time') || lowerType.includes('date') || lowerType.includes('day') || lowerType.includes('month')) return <Clock size={14} className="text-amber-400" />;
        if (lowerType.includes('calculator')) return <Calculator size={14} className="text-purple-400" />;
        if (lowerType.includes('weather')) return <CloudSun size={14} className="text-yellow-300" />;
        if (lowerType.includes('maps')) return <MapPin size={14} className="text-rose-400" />;
        if (lowerType.includes('image')) return <ImageIcon size={14} className="text-emerald-400" />;
        if (lowerType.includes('code') || lowerType.includes('document')) return <FileText size={14} className="text-indigo-400" />;
        return <MessageSquare size={14} className="text-blue-400" />;
    };

    // Format badge text
    const formatBadgeText = (type = '') => {
        if (!type) return 'general';
        return type.replace(/_/g, ' ');
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    return (
        <div className="w-full min-h-screen bg-gradient-to-t from-black to-[#030353] text-white font-sans flex flex-col items-center relative overflow-hidden py-8 px-4">
            
            {/* Background glowing bubbles */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {[...Array(15)].map((_, i) => {
                    const size = 30 + Math.random() * 70;
                    return (
                        <div
                            key={i}
                            className="bubble absolute"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDuration: `${8 + Math.random() * 10}s`,
                                animationDelay: `${Math.random() * 4}s`,
                                width: `${size}px`,
                                height: `${size}px`,
                                opacity: 0.15,
                                zIndex: 0,
                                transform: 'scale(0.8)'
                            }}
                        />
                    );
                })}
            </div>

            {/* Header Content */}
            <div className="w-full max-w-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 z-10 mb-8">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 self-start px-4 py-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 border border-white border-opacity-10 transition-all text-sm font-semibold cursor-pointer shadow-md"
                >
                    <ArrowLeft size={16} />
                    <span>Back to Assistant</span>
                </button>

                <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Command History
                    </h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Viewing interactions for {users?.name || 'User'}
                    </p>
                </div>
            </div>

            {/* Search filter bar */}
            <div className="w-full max-w-3xl z-10 mb-6">
                <div className="relative w-full shadow-lg rounded-xl">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search queries or assistant responses..."
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-black bg-opacity-40 border border-white border-opacity-15 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all backdrop-blur-md"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white text-xs font-semibold cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Main History Logs */}
            <div className="w-full max-w-3xl z-10 flex-1 flex flex-col gap-4">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <Loader className="animate-spin text-cyan-400" size={40} />
                        <p className="text-gray-400 text-sm">Retrieving your logs...</p>
                    </div>
                ) : historyList.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white bg-opacity-5 border border-white border-opacity-5 rounded-2xl p-8 backdrop-blur-md">
                        <Info size={48} className="text-gray-400 mb-3" />
                        <p className="text-lg font-semibold text-gray-200">No command history found</p>
                        <p className="text-gray-400 text-sm text-center max-w-md mt-1">
                            {debounceSearch ? "We couldn't find any logs matching your search criteria." : "Start interacting with your virtual assistant and your conversation history will appear here."}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <AnimatePresence>
                            {historyList.map((item, index) => {
                                const parsed = parseAction(item.action);
                                return (
                                    <motion.div
                                        key={item._id || index}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
                                        className="bg-white bg-opacity-5 hover:bg-opacity-[0.08] border border-white border-opacity-5 rounded-2xl p-5 transition-all duration-300 backdrop-blur-md shadow-md hover:shadow-cyan-950/20"
                                    >
                                        {parsed.isConversation ? (
                                            <div>
                                                {/* User Query */}
                                                <div className="flex gap-3.5 items-start border-b border-white border-opacity-[0.03] pb-3.5 mb-3.5">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shadow-md">
                                                        U
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">User Query</p>
                                                        <p className="text-gray-100 text-sm mt-0.5 break-words font-medium">{parsed.userMsg}</p>
                                                    </div>
                                                </div>

                                                {/* Assistant Response */}
                                                <div className="flex gap-3.5 items-start">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-cyan-400 shadow-md">
                                                        {users?.assistantImage ? (
                                                            <img
                                                                src={users.assistantImage}
                                                                alt="Assistant"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-cyan-600 flex items-center justify-center text-xs font-bold">
                                                                A
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-cyan-400 text-[10px] uppercase font-bold tracking-wider">
                                                            {users?.assistantName || 'Assistant'} Response
                                                        </p>
                                                        <p className="text-gray-200 text-sm mt-0.5 break-words leading-relaxed">{parsed.assistantRes}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3.5 items-center">
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-900 bg-opacity-40 flex items-center justify-center text-cyan-400">
                                                    <Info size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-gray-300 text-sm break-words">{parsed.rawText}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Card Footer Metadata */}
                                        <div className="flex justify-between items-center text-xs text-gray-400 mt-4 border-t border-white border-opacity-[0.03] pt-3">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={12} className="text-gray-400" />
                                                <span>
                                                    {new Date(item.timestamp || item.createdAt).toLocaleString(undefined, {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short'
                                                    })}
                                                </span>
                                            </div>

                                            {parsed.isConversation && parsed.type && (
                                                <div className="flex items-center gap-1.5 bg-white bg-opacity-5 text-gray-300 px-3 py-1 rounded-full text-[10px] border border-white border-opacity-5 font-semibold capitalize shadow-inner">
                                                    {getTypeIcon(parsed.type)}
                                                    <span>{formatBadgeText(parsed.type)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Pagination controls */}
                        {pagination.pages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-6 mb-8">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="px-4.5 py-2 rounded-xl bg-white bg-opacity-5 hover:bg-opacity-10 disabled:opacity-35 disabled:cursor-not-allowed border border-white border-opacity-5 transition-all flex items-center gap-1 cursor-pointer font-medium text-sm shadow-md"
                                >
                                    <ChevronLeft size={16} />
                                    <span>Previous</span>
                                </button>
                                
                                <span className="text-sm font-semibold text-gray-300 select-none bg-black bg-opacity-20 px-3.5 py-1.5 rounded-full border border-white border-opacity-[0.03]">
                                    Page {pagination.page} of {pagination.pages}
                                </span>
                                
                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.pages}
                                    className="px-4.5 py-2 rounded-xl bg-white bg-opacity-5 hover:bg-opacity-10 disabled:opacity-35 disabled:cursor-not-allowed border border-white border-opacity-5 transition-all flex items-center gap-1 cursor-pointer font-medium text-sm shadow-md"
                                >
                                    <span>Next</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
