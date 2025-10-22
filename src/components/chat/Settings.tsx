import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Trash2, Lock, Database } from "lucide-react";
import { clearLocalMessages } from "@/lib/messageStorage";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationPermission, getNotificationStatus } from "@/lib/notifications";

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Settings = ({ open, onOpenChange }: SettingsProps) => {
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    getNotificationStatus() === 'granted'
  );

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const permission = await requestNotificationPermission();
      setNotificationsEnabled(permission === 'granted');
      
      if (permission !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Notifications Enabled",
          description: "You'll receive notifications for new messages",
        });
      }
    } else {
      setNotificationsEnabled(false);
      toast({
        title: "Notifications Disabled",
        description: "You won't receive notifications",
      });
    }
  };

  const handleClearMessages = async () => {
    try {
      await clearLocalMessages();
      toast({
        title: "Messages Cleared",
        description: "All local messages have been deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear messages",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your chat preferences and privacy settings
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Encryption Status */}
          <div className="flex items-start space-x-4 p-4 bg-muted rounded-lg">
            <Lock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">End-to-End Encryption</h4>
              <p className="text-sm text-muted-foreground mt-1">
                All messages are encrypted on your device. Only you and the recipient can read them.
              </p>
            </div>
          </div>

          {/* Local Storage Info */}
          <div className="flex items-start space-x-4 p-4 bg-muted rounded-lg">
            <Database className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Local Message Storage</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Messages are stored locally on your device for privacy and offline access.
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="notifications">Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified of new messages
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
            />
          </div>

          {/* Clear Messages */}
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleClearMessages}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Local Messages
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This will delete all messages stored on this device
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Settings;
