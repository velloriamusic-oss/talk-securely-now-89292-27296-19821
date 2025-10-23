import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/pages/Chat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, LogOut, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatSidebarProps {
  currentUserId: string;
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
}

const ChatSidebar = ({ currentUserId, selectedUser, onSelectUser, onSignOut, onOpenSettings }: ChatSidebarProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchCurrentUserProfile();
  }, [currentUserId]);

  const fetchCurrentUserProfile = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .single();

      if (error) throw error;
      setCurrentUserProfile(data);
    } catch (error: any) {
      console.error("Error fetching current user profile:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, username, public_key, created_at")
        .neq("id", currentUserId);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-60 bg-card border-r border-border flex flex-col">
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-semibold text-base">Charcha App</h2>
              {currentUserProfile && (
                <p className="text-xs text-muted-foreground">{currentUserProfile.username}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-7 w-7">
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} className="h-7 w-7">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className={`w-full p-2 rounded-lg flex items-center gap-2 hover:bg-muted transition-colors ${
                  selectedUser?.id === user.id ? "bg-muted" : ""
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{user.username}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatSidebar;
