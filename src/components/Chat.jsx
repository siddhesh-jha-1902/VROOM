import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Chat({ tripId, currentUser, onClose, isDriver }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!tripId) return;
    const q = query(
      collection(db, 'trips', tripId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [tripId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [lastSent, setLastSent] = useState(0);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !tripId) return;
    
    const now = Date.now();
    if (now - lastSent < 10000) {
      alert("Please wait 10 seconds between messages.");
      return;
    }
    
    const messageText = newMessage.trim();
    setNewMessage('');
    setLastSent(now);
    
    await addDoc(collection(db, 'trips', tripId, 'messages'), {
      text: messageText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || (isDriver ? 'Driver' : 'User'),
      isDriver: isDriver || false,
      timestamp: serverTimestamp(),
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }} 
      animate={{ opacity: 1, scale: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-background border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden flex flex-col h-[400px]"
    >
      <div className="bg-primary text-white p-4 font-bold flex justify-between items-center">
        <span>Chat with {isDriver ? 'User' : 'Driver'}</span>
        <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X size={20} /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/5 dark:bg-black/40">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted text-sm mt-4">Start messaging...</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white dark:bg-black/60 text-text-main rounded-bl-none border border-black/5 dark:border-white/5'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-text-muted mt-1 px-1">
                  {msg.timestamp && typeof msg.timestamp.toDate === 'function' ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-background border-t border-black/10 dark:border-white/10 flex gap-2">
        <input 
          type="text" 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}
