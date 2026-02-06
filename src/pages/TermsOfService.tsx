export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold text-foreground mb-6">Terms of Service</h1>
        <p className="text-muted-foreground mb-4">Last updated: February 6, 2026</p>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing and using this service, you accept and agree to be bound by these Terms of Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Use of Service</h2>
          <p className="text-muted-foreground">
            You agree to use our service only for lawful purposes and in accordance with these Terms. 
            You are responsible for maintaining the security of your account credentials.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Third-Party Integrations</h2>
          <p className="text-muted-foreground">
            Our service integrates with third-party services like Google. Your use of these 
            integrations is also subject to the respective third-party terms and privacy policies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Limitation of Liability</h2>
          <p className="text-muted-foreground">
            We provide this service "as is" without warranties of any kind. We shall not be liable 
            for any indirect, incidental, or consequential damages.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Contact</h2>
          <p className="text-muted-foreground">
            For questions about these Terms, please contact us.
          </p>
        </section>
      </div>
    </div>
  );
}
