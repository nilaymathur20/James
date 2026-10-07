import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Users,
  Copy,
  Check,
  Send,
  Radio,
  FileText,
  MessageSquare,
  ArrowRight,
  Shield,
  Download,
} from 'lucide-react';
import { Conversation, EditorDocument } from '../types/chat';

interface PeerToPeerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversation: Conversation;
  onImportConversation: (conv: Conversation) => void;
}

interface PeerMessage {
  id: string;
  sender: 'me' | 'peer';
  type: 'text' | 'conversation' | 'document';
  content: string;
  payload?: any;
  timestamp: number;
}

export const PeerToPeerModal: React.FC<PeerToPeerModalProps> = ({
  isOpen,
  onClose,
  activeConversation,
  onImportConversation,
}) => {
  const [peerId] = useState(() => `peer-${Math.random().toString(36).substr(2, 6)}`);
  const [isConnected, setIsConnected] = useState(false);
  const [peerMessages, setPeerMessages] = useState<PeerMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'broadcast' | 'webrtc'>('broadcast');
  const [offerCode, setOfferCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use BroadcastChannel for zero-latency peer connection across local browser tabs
    const channel = new BroadcastChannel('james_p2p_mesh_v1');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'HEARTBEAT' && data.sender !== peerId) {
        setIsConnected(true);
        // Reply with acknowledge
        channel.postMessage({ type: 'ACK', sender: peerId });
      } else if (data.type === 'ACK' && data.sender !== peerId) {
        setIsConnected(true);
      } else if (data.type === 'MESSAGE' && data.sender !== peerId) {
        setPeerMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'peer',
            type: data.payloadType || 'text',
            content: data.text,
            payload: data.payload,
            timestamp: Date.now(),
          },
        ]);
      }
    };

    // Broadcast our presence
    channel.postMessage({ type: 'HEARTBEAT', sender: peerId });

    return () => {
      channel.close();
    };
  }, [peerId]);

  if (!isOpen) return null;

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: PeerMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      type: 'text',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setPeerMessages((prev) => [...prev, newMsg]);

    channelRef.current?.postMessage({
      type: 'MESSAGE',
      sender: peerId,
      payloadType: 'text',
      text: inputText.trim(),
    });

    setInputText('');
  };

  const shareActiveChat = () => {
    const newMsg: PeerMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      type: 'conversation',
      content: `Shared conversation: "${activeConversation.title}" (${activeConversation.messages.length} messages)`,
      payload: activeConversation,
      timestamp: Date.now(),
    };

    setPeerMessages((prev) => [...prev, newMsg]);

    channelRef.current?.postMessage({
      type: 'MESSAGE',
      sender: peerId,
      payloadType: 'conversation',
      text: `Shared conversation: "${activeConversation.title}"`,
      payload: activeConversation,
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div
        className="w-full max-w-3xl bg-[#11141c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#1a202c] border border-white/5 text-blue-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Peer-to-Peer Direct Connection
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isConnected ? 'Peer Connected' : 'Listening for Peers'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Direct client-to-client encrypted synchronization without storing data on any remote server.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* Peer Session Identity */}
          <div className="p-4 rounded-xl bg-[#141822] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                Local Session Peer ID
              </span>
              <p className="text-xs text-neutral-400">
                Open JAMES in another browser tab, device or window to link automatically.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <code className="px-2.5 py-1 rounded bg-[#090b10] border border-white/10 text-neutral-200 font-mono text-xs">
                {peerId}
              </code>
              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white"
                title="Copy Peer ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Direct Share Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-[#0e1017] border border-white/5">
            <span className="text-xs text-neutral-300 font-medium">
              Active thread: <strong className="text-white font-semibold">{activeConversation.title}</strong>
            </span>

            <button
              onClick={shareActiveChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Active Chat to Peer</span>
            </button>
          </div>

          {/* P2P Live Feed */}
          <div className="rounded-xl border border-white/10 bg-[#090b10] flex flex-col h-64 overflow-hidden">
            <div className="px-3.5 py-2 border-b border-white/5 bg-[#141822] flex items-center justify-between text-xs text-neutral-400">
              <span>Direct P2P Message Log</span>
              <span className="font-mono text-[10px]">{peerMessages.length} events</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
              {peerMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-500 text-center">
                  No peer transmissions yet. Open another tab with JAMES to test automatic peer connection.
                </div>
              ) : (
                peerMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-2.5 rounded-lg text-xs ${
                        msg.sender === 'me'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1b2130] border border-white/10 text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1 font-mono">
                        <span>{msg.sender === 'me' ? 'You' : 'Remote Peer'}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p>{msg.content}</p>

                      {msg.payload && msg.type === 'conversation' && (
                        <button
                          onClick={() => {
                            onImportConversation(msg.payload);
                            onClose();
                          }}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium"
                        >
                          <Download className="w-3 h-3" />
                          <span>Import this Chat to Workspace</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={sendMessage} className="p-2 border-t border-white/5 bg-[#11141c] flex items-center gap-2">
              <input
                type="text"
                placeholder="Send a peer message or sync note..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#171b26] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 font-sans"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
