import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/pages/Chat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  generateKeyPair,
  storeKeyPair,
  getKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  getCachedSharedKey,
  cacheSharedKey,
  KeyPair,
} from "@/lib/crypto";
import {
  storeMessageLocally,
  getLocalMessages,
  getChatId,
  StoredMessage,
} from "@/lib/messageStorage";
import { showMessageNotification } from "@/lib/notifications";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface ChatWindowProps {
  currentUserId: string;
  selectedUser: Profile | null;
}

const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(5000, "Message is too long"),
});

const ChatWindow = ({ currentUserId, selectedUser }: ChatWindowProps) => {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const myKeyPairRef = useRef<KeyPair | null>(null);

  // Initialize encryption keys
  useEffect(() => {
    initializeEncryption();
  }, [currentUserId]);

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      setupSharedKey();
      subscribeToMessages();
    }
  }, [selectedUser, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const initializeEncryption = async () => {
    try {
      let keyPair = await getKeyPair();

      if (!keyPair) {
        // Generate new key pair for this user
        keyPair = await generateKeyPair();
        await storeKeyPair(keyPair);

        // Upload public key to server
        const { error } = await (supabase as any)
          .from("profiles")
          .update({ public_key: JSON.stringify(keyPair.publicKey) })
          .eq("id", currentUserId);

        if (error) {
          console.error("Failed to upload public key:", error);
          throw error;
        }
      }

      myKeyPairRef.current = keyPair;
      setEncryptionReady(true);
    } catch (error) {
      console.error("Failed to initialize encryption:", error);
      toast({
        title: "Encryption Error",
        description: "Failed to initialize encryption keys",
        variant: "destructive",
      });
    }
  };

  const setupSharedKey = async () => {
    if (!selectedUser || !myKeyPairRef.current) {
      console.log("Missing selectedUser or keyPair");
      return;
    }

    try {
      // Check if we have cached shared key
      let sharedKey = await getCachedSharedKey(selectedUser.id);

      if (!sharedKey) {
        console.log("No cached key, fetching peer's public key...");
        
        // Fetch peer's public key from server
        const { data: peerProfile, error } = await (supabase as any)
          .from("profiles")
          .select("public_key")
          .eq("id", selectedUser.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching peer profile:", error);
          throw error;
        }

        if (!peerProfile || !peerProfile.public_key) {
          console.error("Peer has no public key");
          toast({
            title: "Encryption Not Available",
            description: `${selectedUser.username} hasn't set up encryption yet. Ask them to log in once to initialize encryption.`,
          });
          return;
        }

        console.log("Peer public key found, deriving shared key...");
        const peerPublicKey = JSON.parse(peerProfile.public_key);

        // Derive shared key
        sharedKey = await deriveSharedKey(
          myKeyPairRef.current.privateKey,
          peerPublicKey
        );

        // Cache it
        await cacheSharedKey(selectedUser.id, sharedKey);
        console.log("Shared key derived and cached successfully");
      } else {
        console.log("Using cached shared key");
      }

      sharedKeyRef.current = sharedKey;
    } catch (error) {
      console.error("Failed to setup shared key:", error);
      toast({
        title: "Encryption Error",
        description: error instanceof Error ? error.message : "Failed to establish secure connection. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async () => {
    if (!selectedUser) return;

    try {
      // Load messages from local storage only
      const chatId = getChatId(currentUserId, selectedUser.id);
      const localMessages = await getLocalMessages(chatId);
      setMessages(localMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedUser) return;

    const channel = supabase
      .channel(`messages:${selectedUser.id}:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Only process messages for this chat
          if (
            (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === selectedUser.id)
          ) {
            await handleNewMessage(newMsg);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNewMessage = async (message: Message) => {
    if (!sharedKeyRef.current) {
      await setupSharedKey();
    }

    try {
      // Decrypt message
      const decryptedContent = sharedKeyRef.current
        ? await decryptMessage(message.content, sharedKeyRef.current)
        : message.content;

      const storedMessage: StoredMessage = {
        id: message.id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: decryptedContent,
        created_at: message.created_at,
        chat_id: getChatId(message.sender_id, message.receiver_id),
      };

      // Store locally
      await storeMessageLocally(storedMessage);

      // Messages are now marked as delivered when sent, no need to update here

      // Update UI
      setMessages((prev) => [...prev, storedMessage]);

      // Show notification if message is from other user
      if (message.sender_id === selectedUser?.id) {
        showMessageNotification(
          selectedUser.username,
          decryptedContent.substring(0, 50)
        );
      }
    } catch (error) {
      console.error("Failed to handle new message:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMessage.trim() || !sharedKeyRef.current) return;

    try {
      const validated = messageSchema.parse({ content: newMessage });
      setLoading(true);

      // Encrypt message
      const encryptedContent = await encryptMessage(
        validated.content,
        sharedKeyRef.current
      );

      const { error } = await (supabase as any).from("messages").insert({
        sender_id: currentUserId,
        receiver_id: selectedUser.id,
        content: encryptedContent,
        encrypted: true,
        delivered_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to send message:", error);
        throw error;
      }

      // Store locally (with decrypted content)
      const localMessage: StoredMessage = {
        id: crypto.randomUUID(),
        sender_id: currentUserId,
        receiver_id: selectedUser.id,
        content: validated.content,
        created_at: new Date().toISOString(),
        chat_id: getChatId(currentUserId, selectedUser.id),
      };

      await storeMessageLocally(localMessage);
      setMessages((prev) => [...prev, localMessage]);
      setNewMessage("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-bg">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-base text-muted-foreground">Select a user to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-chat-bg">
      <div className="p-3 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">{selectedUser.username}</h2>
            <p className="text-xs text-muted-foreground">
              {sharedKeyRef.current ? "Secure connection established" : "Setting up encryption..."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className={sharedKeyRef.current ? "w-3.5 h-3.5 text-green-500" : "w-3.5 h-3.5"} />
            <span className={sharedKeyRef.current ? "text-green-500" : ""}>
              {sharedKeyRef.current ? "Encrypted" : "Encrypting..."}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((message) => {
            const isSent = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-2 ${
                    isSent
                      ? "bg-message-sent text-primary-foreground"
                      : "bg-message-received"
                  }`}
                >
                  <p className="break-words text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      isSent ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-3 bg-card border-t border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={loading || !encryptionReady}
            className="flex-1 h-8 text-sm"
          />
          <Button
            type="submit"
            disabled={loading || !newMessage.trim() || !encryptionReady}
            className="hover:bg-primary-hover h-8 w-8 p-0"
            size="icon"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;
