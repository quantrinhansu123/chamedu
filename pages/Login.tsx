import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, BookOpen } from 'lucide-react';
import { useAuth } from '../src/hooks/useAuth';
import brandLogo from './Logo tách nền.png';

const REMEMBER_ME_KEY = 'brisky_remember_email';

export const Login: React.FC = () => {
  // Initialize email from localStorage if "remember me" was used
  const [email, setEmail] = useState(() => {
    return localStorage.getItem(REMEMBER_ME_KEY) || '';
  });
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem(REMEMBER_ME_KEY);
  });
  const { signIn, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    try {
      setIsLoading(true);

      // Save or remove email based on "remember me" checkbox
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      await signIn(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex login-page"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Left Panel - Brand & Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#F8D548] via-[#F7B500] to-[#F08A24] relative overflow-hidden">
        {/* Decorative Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="books" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M20 40h40v60h-40z M80 60h40v80h-40z M140 30h40v70h-40z" fill="white" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#books)"/>
        </svg>

        {/* Floating Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 text-white/20 animate-float-slow">
            <BookOpen size={120} strokeWidth={1} />
          </div>
          <div className="absolute bottom-40 right-32 text-white/15 animate-float-delayed">
            <BookOpen size={80} strokeWidth={1} />
          </div>
          <div className="absolute top-1/2 left-1/4 text-white/10">
            <span className="text-9xl font-bold">A</span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-20">
          <div className="space-y-8">
            <div className="inline-block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2 border-2 border-white/20">
                <img 
                  src={brandLogo}
                  alt="Chăm edu Logo" 
                  className="w-[42rem] h-[42rem] max-w-[49vw] max-h-[68vh] object-contain drop-shadow-2xl"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-6xl font-bold text-white leading-tight">
                Chăm edu
              </h1>
              <div className="w-24 h-1 bg-white/80"></div>
            </div>
          </div>
        </div>

        {/* Bottom Accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 bg-[#FFFBF0] relative overflow-hidden">
        {/* Subtle Background Texture */}
        <div className="absolute inset-0 opacity-30">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#A95A00" opacity="0.12"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)"/>
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
          <div className="w-full max-w-md space-y-8 animate-fade-up">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-12">
              <img 
                src={brandLogo}
                alt="Chăm edu Logo" 
                className="w-80 h-80 max-w-[85vw] max-h-[45vh] mx-auto object-contain mb-4"
              />
              <h1 className="text-4xl font-bold text-[#5A3416]">
                Chăm edu
              </h1>
            </div>

            {/* Form Header */}
            <div className="space-y-3">
              <h2 className="text-4xl font-bold text-[#5A3416]">
                Đăng nhập
              </h2>
              <p className="text-gray-600">Truy cập vào hệ thống quản lý của bạn</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-shake-subtle">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="relative">
                <label 
                  htmlFor="email" 
                  className={`absolute left-4 transition-all duration-300 pointer-events-none z-10 ${
                    emailFocused || email 
                      ? '-top-2.5 text-xs bg-[#FFFBF0] px-2 text-[#A95A00] font-semibold' 
                      : 'top-4 text-base text-gray-500'
                  }`}
                >
                  Địa chỉ email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#F7B500] transition-all text-gray-900 shadow-sm hover:border-gray-300"
                    required
                    autoComplete="email"
                  />
                  <Mail 
                    size={20} 
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${
                      emailFocused ? 'text-[#A95A00]' : 'text-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <label 
                  htmlFor="password" 
                  className={`absolute left-4 transition-all duration-300 pointer-events-none z-10 ${
                    passwordFocused || password 
                      ? '-top-2.5 text-xs bg-[#FFFBF0] px-2 text-[#A95A00] font-semibold' 
                      : 'top-4 text-base text-gray-500'
                  }`}
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#F7B500] transition-all text-gray-900 shadow-sm hover:border-gray-300"
                    required
                    autoComplete="current-password"
                  />
                  <Lock 
                    size={20} 
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${
                      passwordFocused ? 'text-[#A95A00]' : 'text-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* Options Row */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-[#F7B500] border-gray-300 rounded focus:ring-[#F7B500] cursor-pointer accent-[#F7B500]"
                  />
                  <span className="text-gray-700 group-hover:text-[#1A1F3A] transition-colors">
                    Ghi nhớ tôi
                  </span>
                </label>
                <a 
                  href="#" 
                  className="text-[#A95A00] hover:text-[#F08A24] font-medium transition-colors relative group"
                >
                  Quên mật khẩu?
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#A95A00] group-hover:w-full transition-all duration-300"></span>
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="group relative w-full bg-gradient-to-r from-[#F7B500] to-[#F08A24] text-white py-4 px-6 rounded-lg font-semibold text-base hover:from-[#E2A600] hover:to-[#DD7B15] focus:outline-none focus:ring-4 focus:ring-[#F7B500]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:hover:from-[#F7B500] disabled:hover:to-[#F08A24] overflow-hidden"
              >
                <span className="relative flex items-center justify-center gap-3">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Đang đăng nhập...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng nhập</span>
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
              </button>
            </form>

            {/* Footer */}
            <div className="pt-8 text-center">
              <p className="text-sm text-gray-500">
                © 2025 Chăm edu
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-page,
        .login-page input,
        .login-page button,
        .login-page label,
        .login-page a,
        .login-page p,
        .login-page h1,
        .login-page h2 {
          font-family: 'Times New Roman', Times, serif;
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake-subtle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) rotate(5deg);
          }
        }

        @keyframes float-delayed {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(-3deg);
          }
        }

        .animate-fade-up {
          animation: fade-up 0.6s ease-out;
        }

        .animate-shake-subtle {
          animation: shake-subtle 0.4s ease-in-out;
        }

        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 6s ease-in-out infinite 1s;
        }
      `}</style>
    </div>
  );
};
