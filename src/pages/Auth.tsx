import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Shield, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const signUpSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(50, "Password must be less than 50 characters"),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [signUpData, setSignUpData] = useState({ username: "", email: "", password: "" });
  const [signInData, setSignInData] = useState({ email: "", password: "" });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/chat");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signUpSchema.parse(signUpData);
      
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { username: validated.username },
          emailRedirectTo: `${window.location.origin}/chat`,
        },
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "Welcome to Charcha App. Redirecting...",
      });
      
      navigate("/chat");
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
          description: error.message || "Failed to sign up",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse(signInData);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Signing you in...",
      });
      
      navigate("/chat");
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
          description: error.message || "Failed to sign in",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!showAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-3">
            <MessageCircle className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-3xl font-bold">Welcome to Charcha App</h1>
            <p className="text-base text-muted-foreground">Connect with friends and family instantly</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <Card>
              <CardHeader className="p-4">
                <Shield className="w-7 h-7 text-primary mb-1" />
                <CardTitle className="text-base">End-to-End Encryption</CardTitle>
                <CardDescription className="text-sm">Your messages are secure and private</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <Zap className="w-7 h-7 text-primary mb-1" />
                <CardTitle className="text-base">Real-time Messaging</CardTitle>
                <CardDescription className="text-sm">Instant message delivery and notifications</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <Users className="w-7 h-7 text-primary mb-1" />
                <CardTitle className="text-base">Find Friends</CardTitle>
                <CardDescription className="text-sm">Easily search and connect with users</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <MessageCircle className="w-7 h-7 text-primary mb-1" />
                <CardTitle className="text-base">Simple Interface</CardTitle>
                <CardDescription className="text-sm">Clean and intuitive design</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="flex justify-center mt-6">
            <Button size="default" onClick={() => setShowAuth(true)} className="hover:bg-primary-hover">
              Continue to Chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center p-4">
          <MessageCircle className="w-9 h-9 text-primary mx-auto mb-1" />
          <CardTitle className="text-lg">Welcome to Charcha App</CardTitle>
          <CardDescription className="text-sm">Sign in or create an account to start chatting</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="signin" className="text-sm">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="text-sm">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password" className="text-sm">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <Button type="submit" className="w-full hover:bg-primary-hover text-sm" disabled={loading} size="sm">
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-username" className="text-sm">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Choose a username"
                    value={signUpData.username}
                    onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-sm">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-sm">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <Button type="submit" className="w-full hover:bg-primary-hover text-sm" disabled={loading} size="sm">
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
