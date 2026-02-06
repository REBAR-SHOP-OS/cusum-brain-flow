import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FacebookCommenterSettings } from "@/components/facebook/FacebookCommenterSettings";

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  content: string;
  date: string;
  reply?: {
    content: string;
    date: string;
  };
}

interface FacebookPost {
  id: string;
  pageName: string;
  pageAvatar: string;
  title: string;
  content: string;
  comments: Comment[];
}

// Sample data based on reference images
const samplePosts: FacebookPost[] = [
  {
    id: "1",
    pageName: "Rebar.shop",
    pageAvatar: "",
    title: "HOW BRICKS ARE REALLY MADE",
    content: "It's hot, loud, and powerful — this is the real factory behind the walls we live in.\n\nFrom clay to kiln to stacked perfecti...",
    comments: [
      {
        id: "c1",
        userName: "Attilio Berno",
        content: "N",
        date: "05-21 02:14",
        reply: {
          content: "Hi Attilio, thanks for your comment! If you have any specific questions or thoughts you'd like to share about how bricks are made or the process shown in our post, feel free to let us know—we're here to discuss!",
          date: "05-28 12:24"
        }
      }
    ]
  },
  {
    id: "2",
    pageName: "Rebar.shop",
    pageAvatar: "",
    title: "HOW BRICKS ARE REALLY MADE",
    content: "It's hot, loud, and powerful — this is the real factory behind the walls we live in.\n\nFrom clay to kiln to stacked perfecti...",
    comments: [
      {
        id: "c2",
        userName: "Abdul-Qadir Aliyu",
        content: "❤️",
        date: "05-22 01:39",
        reply: {
          content: "Thank you for the love! We're glad you're enjoying our behind-the-scenes processes!",
          date: "05-28 14:15"
        }
      }
    ]
  }
];

export default function FacebookCommenter() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const pendingReviewCount = 1;

  if (showSettings) {
    return (
      <FacebookCommenterSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        onBack={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/integrations")}
          className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold mb-2">Comments Overview</h1>
          <p className="text-muted-foreground mb-6">
            Comments you've replied to - {samplePosts.reduce((acc, post) => acc + post.comments.length, 0)}
          </p>

          {/* Posts with Comments */}
          <div className="space-y-6">
            {samplePosts.map((post) => (
              <div key={post.id} className="border rounded-lg p-4 bg-card">
                {/* Post Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600">
                      <AvatarFallback className="text-white text-xs font-bold">
                        R
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{post.pageName}</p>
                      <p className="text-xs text-muted-foreground">Facebook Post</p>
                    </div>
                  </div>
                  <button className="text-sm text-muted-foreground hover:text-foreground underline">
                    View
                  </button>
                </div>

                {/* Post Content */}
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-1">{post.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {post.content.split('\n')[0]}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {post.content.split('\n').slice(1).join(' ')}
                    <button className="ml-1 underline font-medium text-foreground">See more</button>
                  </p>
                </div>

                {/* Comments */}
                {post.comments.map((comment) => (
                  <div key={comment.id} className="space-y-3">
                    {/* User Comment */}
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 bg-gray-300">
                        <AvatarFallback className="text-xs">
                          {comment.userName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-muted/50 rounded-lg px-3 py-2 inline-block">
                          <p className="font-medium text-sm">{comment.userName}</p>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{comment.date}</p>
                      </div>
                    </div>

                    {/* Reply */}
                    {comment.reply && (
                      <div className="flex items-start gap-3 ml-8">
                        <Avatar className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600">
                          <AvatarFallback className="text-white text-xs font-bold">
                            R
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-muted rounded-lg px-3 py-2">
                            <p className="font-medium text-sm">{post.pageName}</p>
                            <p className="text-sm text-muted-foreground">{comment.reply.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{comment.reply.date}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Review Button */}
      {pendingReviewCount > 0 && (
        <div className="p-4 max-w-2xl mx-auto w-full">
          <Button className="w-full bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white">
            Review comments ({pendingReviewCount})
          </Button>
        </div>
      )}
    </div>
  );
}
