import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  EyeOff, 
  FileText, 
  Store, 
  HelpCircle, 
  Mail, 
  AlertCircle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  const lastUpdated = 'September 27, 2026';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-coral-brand selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
              title="Return to Won More Home"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-brand text-coral-brand flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none block">
                  Won More
                </span>
                <span className="text-[10px] text-teal-brand font-bold uppercase tracking-wider">
                  Legal & Trust Center
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        
        {/* Title Banner */}
        <div className="space-y-3 border-b border-slate-200 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Customer Privacy & Fair Promotion Policy</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy & Terms of Participation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Effective Date: <strong>{lastUpdated}</strong> • Applies to all customer scratch-and-win campaigns, merchant promotional links, and the Won More platform.
          </p>
        </div>

        {/* Quick Executive Summary Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <EyeOff className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Zero Data Brokerage</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              We never sell, rent, or trade your personal phone number or name to external advertisers or telemarketers.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Store Direct Delivery</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your details are shared solely with the participating store you visited to verify and honor your prize.
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-coral-brand/10 text-coral-brand flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">TLS Encryption</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Encrypted end-to-end with Row Level Security (RLS) and fraud-proof digital verification tokens.
            </p>
          </div>
        </div>

        {/* Formal Legal Content Sections */}
        <article className="prose prose-slate max-w-none space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
          
          {/* Section 1 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">1</span>
              <span>Platform Operator vs. Participating Merchant Roles</span>
            </h2>
            <p>
              This Privacy Policy governs the relationship between you (the <strong>"Customer"</strong> or <strong>"Participant"</strong>), the independent business establishment whose promotional campaign you are participating in (the <strong>"Merchant"</strong> or <strong>"Shop"</strong>), and <strong>Won More</strong> (the <strong>"Platform"</strong>, <strong>"we"</strong>, <strong>"us"</strong>, or <strong>"our"</strong>).
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                <strong>Won More as Data Processor:</strong> We provide the digital software infrastructure, QR code standees, and server software enabling merchants to conduct interactive scratch campaigns. We process customer information strictly on behalf of the organizing merchant.
              </li>
              <li>
                <strong>The Merchant as Data Controller:</strong> The participating merchant who created the campaign is the independent Data Controller (or Data Fiduciary under the Digital Personal Data Protection Act). The merchant determines campaign rules, awards prizes, and receives your contact details to fulfill rewards.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">2</span>
              <span>Information We Collect</span>
            </h2>
            <p>
              When you scan a campaign QR code or open a promotional scratch link, we may collect the following data points:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                <strong>Contact Information:</strong> Your name, mobile phone number, WhatsApp number, and email address (if specified by the merchant).
              </li>
              <li>
                <strong>Prize & Game Participation Data:</strong> The exact date and timestamp of your participation, the reward outcome revealed, and your cryptographic unique redemption voucher code (e.g. <code>WIN-849201</code>).
              </li>
              <li>
                <strong>Merchant Custom Fields:</strong> Any specific non-sensitive information requested by the merchant for order matching (such as store bill number, table number, or birth date).
              </li>
              <li>
                <strong>Anti-Fraud Technical Data:</strong> Masked IP address, device browser type, and interaction timestamps. This data is collected solely for anti-abuse rate limiting (e.g., preventing automated bots from depleting merchant prize stocks or malicious brute-force attempts).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">3</span>
              <span>Purpose & Legal Basis of Processing</span>
            </h2>
            <p>
              We process personal information under the legal bases of legitimate interest and performance of a promotional engagement requested by the customer:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>To issue a valid, verifiable digital scratch card and generate your unique prize voucher.</li>
              <li>To transmit the voucher to you via on-screen display and pre-filled WhatsApp claim message.</li>
              <li>To enable the merchant's staff to verify your redemption code in-store and prevent fraudulent duplicate claims.</li>
              <li>To protect merchants from automated bots and ensure fair prize distribution according to mathematical probability algorithms.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">4</span>
              <span>Promotional Nature: Not Gambling or Lottery</span>
            </h2>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Customer Loyalty & Retail Courtesy Notice</span>
              </div>
              <p>
                Won More campaigns are customer loyalty, engagement, and promotional discount mechanisms. Participation does not require real-money entry fees, betting, or wagering. Every participating customer receives a promotional discount, gift voucher, or courtesy perk determined by the merchant.
              </p>
            </div>
            <p>
              All prizes, gifts, vouchers, and discounts are sponsored and fulfilled solely by the organizing merchant. Won More does not sell merchandise, supply physical products, or distribute monetary payouts.
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">5</span>
              <span>Merchant Responsibility & Prize Disclaimers</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>
                <strong>Merchant Fulfillment Sole Liability:</strong> The merchant holding the campaign possesses sole, undivided responsibility for honoring rewards, upholding product quality, and verifying customer redemption codes. Won More shall have no liability whatsoever for out-of-stock items, expired vouchers, merchant refusal of service, or store closures.
              </li>
              <li>
                <strong>Non-Transferability:</strong> Redemption codes are unique to the recipient and non-transferable unless permitted in writing by the merchant. Codes cannot be exchanged for cash or legal currency unless expressly stipulated by local retail regulations.
              </li>
              <li>
                <strong>Expiration Dates:</strong> All prizes are subject to the validity dates established in the merchant's campaign schedule. Expired codes cannot be regenerated or redeemed once the campaign concludes.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">6</span>
              <span>Data Security & Sub-Processors</span>
            </h2>
            <p>
              We implement enterprise-grade technical safeguards to prevent unauthorized access, alteration, or disclosure:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Cloudflare Inc.:</strong> Global Content Delivery Network (CDN), DDoS mitigation, and SSL/TLS edge routing.</li>
              <li><strong>Supabase / PostgreSQL:</strong> Encrypted cloud database storage with granular Row Level Security (RLS) isolating each merchant's customer leads.</li>
              <li><strong>WhatsApp / Meta Platforms:</strong> When you click "Claim on WhatsApp", you are redirected to the official WhatsApp protocol (wa.me) using your own WhatsApp account. Won More does not read your private chat messages.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">7</span>
              <span>Your Data Rights & Erasure Requests</span>
            </h2>
            <p>
              Subject to applicable privacy statutes (including India DPDPA, EU GDPR, and regional consumer data protections), you hold the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Right to Know & Access:</strong> You may request a confirmation of whether your data was processed during a campaign.</li>
              <li><strong>Right to Rectification:</strong> You may request corrections to incorrect phone or contact numbers.</li>
              <li><strong>Right to Erasure (Right to be Forgotten):</strong> You may request the deletion of your customer record once your prize redemption cycle is concluded.</li>
            </ul>
            <p className="pt-2">
              To exercise any of these rights, contact the merchant directly at their store or email our compliance desk at <a href="mailto:privacy@wonmore.com" className="text-teal-brand font-semibold hover:underline">privacy@wonmore.com</a>. Requests are resolved within 30 days.
            </p>
          </section>

          {/* Section 8 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">8</span>
              <span>Limitation of Liability</span>
            </h2>
            <p>
              To the maximum extent permitted under applicable law, Won More, its officers, employees, and software providers shall not be held liable for any indirect, incidental, punitive, or consequential damages resulting from store promotions, customer-merchant disputes, technical network delays, or the redemption of merchant merchandise.
            </p>
          </section>

          {/* Section 9 */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">9</span>
              <span>Contact Us & Grievance Officer</span>
            </h2>
            <p>
              For questions concerning this Privacy Policy, legal compliance, or merchant campaign inquiries, please contact:
            </p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-xs text-slate-700">
              <p className="font-bold text-slate-900">Won More Trust & Compliance Desk</p>
              <p>Email: <a href="mailto:privacy@wonmore.com" className="text-teal-brand hover:underline">privacy@wonmore.com</a> / <a href="mailto:support@wonmore.com" className="text-teal-brand hover:underline">support@wonmore.com</a></p>
              <p>Platform: Won More Scratch & Win Loyalty SaaS</p>
              <p>Response SLA: Within 48 business hours</p>
            </div>
          </section>

        </article>

        {/* Bottom Back Button */}
        <div className="pt-6 border-t border-slate-200 text-center">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Campaign / Store</span>
          </button>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Won More SaaS. All rights reserved.</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Designed for transparency, legal compliance, and customer privacy protection.
        </p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
