import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashScreen() {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1800);
    const t2 = setTimeout(() => navigate('/login'), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="animate-bounce mb-6">
        <span className="text-7xl">🍬</span>
      </div>
      <h1 className="text-4xl font-display font-bold text-white">Shyam Sweets</h1>
      <p className="text-amber-100 mt-2 text-sm">Fresh Mithai, Delivered Fast</p>
      <div className="mt-8">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    </div>
  );
}
