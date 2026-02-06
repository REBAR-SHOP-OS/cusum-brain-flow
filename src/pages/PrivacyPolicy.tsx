export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold text-foreground mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground mb-4">Last updated: February 6, 2026</p>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect information you provide directly, including email address and profile information 
            when you create an account. When you connect third-party services (like Gmail), we access 
            only the data necessary to provide our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use your information to provide and improve our services, communicate with you, 
            and ensure security of your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Data Security</h2>
          <p className="text-muted-foreground">
            We implement appropriate security measures to protect your personal information. 
            OAuth tokens are securely stored and encrypted.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy, please contact us.
          </p>
        </section>
      </div>
    </div>
  );
}
