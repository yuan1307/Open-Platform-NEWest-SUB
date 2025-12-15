
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';
import { Mail, Shield, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const ContactUs: React.FC = () => {
  const { t } = useLanguage();
  const [admins, setAdmins] = useState<User[]>([]);

  useEffect(() => {
    const load = async () => {
        const results = await db.scan<User>('basis_user_');
        const loadedAdmins = results.map(r => r.value).filter(u => u.role === 'admin' || u.role === 'secondary_admin');
        setAdmins(loadedAdmins);
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-10 text-center"><h1 className="text-3xl font-bold text-slate-800 mb-3">{t.contact.title}</h1><p className="text-slate-500">{t.contact.subtitle}</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {admins.map(admin => (
            <div key={admin.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:border-brand-200 transition-all">
                <div className={`p-3 rounded-full ${admin.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{admin.role === 'admin' ? <ShieldCheck size={24} /> : <Shield size={24} />}</div>
                <div><h3 className="font-bold text-slate-800 text-lg">{admin.name || 'Administrator'}</h3><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${admin.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{admin.role === 'admin' ? t.admin.superAdmin : t.admin.secAdmin}</span><div className="mt-3 text-sm text-slate-600 flex items-center gap-2"><Mail size={14} /> {admin.email || 'siyuan.liu14548-biph@basischina.com'}</div></div>
            </div>
        ))}
      </div>
    </div>
  );
};
export default ContactUs;
