import { useState } from 'react'
import { User, Lock, Bell } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ebebeb] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f0f0f0]">
        <p className="text-[13px] font-bold tracking-widest text-[#111] uppercase">{title}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, value, type = 'text' }: { label: string; value: string; type?: string }) {
  const [val, setVal] = useState(value)
  return (
    <div>
      <label className="block text-[11px] font-semibold tracking-widest text-[#aaa] uppercase mb-1.5">{label}</label>
      <input
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full bg-[#f9f9f9] border border-[#ebebeb] rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#111] outline-none focus:border-[#ccc] transition-colors"
      />
    </div>
  )
}

function Toggle({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-semibold text-[#111]">{label}</p>
        <p className="text-[12px] text-[#aaa] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${on ? 'bg-[#111]' : 'bg-[#ddd]'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
      </button>
    </div>
  )
}

export function AccountSettingsPage() {
  return (
    <div className="p-6 max-w-[640px] mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#111]">Account Settings</h1>
        <p className="text-[13px] text-[#888] mt-1">Manage your profile and preferences</p>
      </div>

      <Section title="Profile">
        <div className="flex items-center gap-4 pb-2">
          <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0">
            AL
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#111]">A. Lewis</p>
            <p className="text-[12px] text-[#aaa] font-medium">Supervisor</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" value="Andre" />
          <Field label="Last Name" value="Lewis" />
        </div>
        <Field label="Email" value="a.lewis@yaadmanenergy.com" type="email" />
        <Field label="Phone" value="+1 (876) 555-0142" />
        <div className="pt-1">
          <button className="px-5 py-2 bg-[#111] text-white text-[13px] font-semibold rounded-xl hover:bg-[#333] transition-colors">
            Save changes
          </button>
        </div>
      </Section>

      <Section title="Security">
        <Field label="Current Password" value="" type="password" />
        <Field label="New Password" value="" type="password" />
        <Field label="Confirm New Password" value="" type="password" />
        <div className="pt-1">
          <button className="px-5 py-2 bg-[#111] text-white text-[13px] font-semibold rounded-xl hover:bg-[#333] transition-colors">
            Update password
          </button>
        </div>
      </Section>

      <Section title="Notifications">
        <Toggle label="Shift reminders" description="Get notified before your shift starts" defaultOn />
        <Toggle label="Low stock alerts" description="Receive alerts when fuel levels are low" defaultOn />
        <Toggle label="End of day summary" description="Daily report sent to your email" />
      </Section>
    </div>
  )
}
