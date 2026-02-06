import { Search, FileText, Users, Package, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

const knowledgeCategories = [
  { name: "Customers", count: 247, icon: Users },
  { name: "Products", count: 1842, icon: Package },
  { name: "Documents", count: 523, icon: FileText },
  { name: "Recent", count: 28, icon: Clock },
];

export default function Brain() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Brain</h1>
          <p className="text-sm text-muted-foreground">Search knowledge & context</p>
        </div>
      </header>

      {/* Search */}
      <div className="p-6 border-b border-border">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search customers, orders, documents..."
            className="pl-10 h-12 bg-secondary border-0"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 p-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">BROWSE</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {knowledgeCategories.map((category) => (
            <button
              key={category.name}
              className="flex flex-col items-start p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <category.icon className="w-6 h-6 text-primary mb-3" />
              <span className="font-medium">{category.name}</span>
              <span className="text-sm text-muted-foreground">{category.count} items</span>
            </button>
          ))}
        </div>

        {/* Placeholder content */}
        <div className="mt-8 p-8 rounded-lg border border-dashed border-border text-center">
          <p className="text-muted-foreground">
            Knowledge base will sync with CRM, documents, and communications.
          </p>
        </div>
      </div>
    </div>
  );
}
