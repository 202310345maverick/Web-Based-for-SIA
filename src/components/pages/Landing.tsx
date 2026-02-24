'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Footer } from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import { 
  CheckCircle,
  Shield,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  const benefits = [
    {
      icon: Sparkles,
      title: 'Speed',
      description: 'Accelerate the grading process from hours to minutes'
    },
    {
      icon: Shield,
      title: 'Accuracy',
      description: 'Minimize manual checking and reduce human error'
    },
    {
      icon: CheckCircle,
      title: 'Reliability',
      description: 'Unrecognized IDs are automatically flagged to prevent invalid grading'
    }
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FEF9E7 0%, #FFF9E6 25%, #FFFBEA 50%, #FEF9E7 75%, #FFF4D6 100%)' }}>
      {/* Navigation */}
      <nav className="border-b backdrop-blur-sm sticky top-0 z-50" style={{ 
        background: 'linear-gradient(90deg, rgba(254, 249, 231, 0.95) 0%, rgba(255, 249, 230, 0.95) 50%, rgba(254, 249, 231, 0.95) 100%)',
        borderColor: '#E6D7A0',
        boxShadow: '0 2px 8px rgba(179, 139, 0, 0.1)'
      }}>
        <div className="w-full max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-12 xs:h-13 sm:h-14 md:h-16">
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center" style={{ 
                background: 'linear-gradient(135deg, #166534 0%, #1a7a3e 100%)',
                boxShadow: '0 2px 4px rgba(22, 101, 52, 0.2)'
              }}>
                <span className="text-lg xs:text-xl sm:text-2xl font-bold" style={{ color: '#FFD700' }}>S</span>
              </div>
              <div>
                <h1 className="text-sm xs:text-base sm:text-lg font-bold" style={{ 
                  background: 'linear-gradient(135deg, #166534 0%, #1a7a3e 50%, #B38B00 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>SIA</h1>
                <p className="text-xs -mt-0.5" style={{ color: '#B38B00' }}>Smart Exam Checking</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="gap-1 h-8 xs:h-9 sm:h-10 text-xs sm:text-sm flex-shrink-0 ml-2 px-3 xs:px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, #B38B00 0%, #D4A500 100%)',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(179, 139, 0, 0.3)'
              }}
            >
              <span className="hidden xs:inline">Get Started</span>
              <span className="xs:hidden">Start</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-8 xs:py-12 sm:py-16 md:py-20 lg:py-24 px-2 xs:px-3 sm:px-4 lg:px-6 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ 
            background: 'radial-gradient(circle, #FFD700 0%, #B38B00 50%, transparent 70%)',
            animation: 'float 20s ease-in-out infinite'
          }}></div>
          <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ 
            background: 'radial-gradient(circle, #B38B00 0%, #166534 50%, transparent 70%)',
            animation: 'float 25s ease-in-out infinite reverse'
          }}></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 xs:mb-5 sm:mb-6 leading-tight tracking-tight" 
              style={{ 
                background: 'linear-gradient(135deg, #166534 0%, #1a7a3e 20%, #B38B00 40%, #FFD700 60%, #B38B00 80%, #166534 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 20px rgba(179, 139, 0, 0.1)',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 8s ease infinite'
              }}>
            Smart Exam Checking<br />& Auto-Grading System
          </h1>
          
          <p className="text-xs xs:text-sm sm:text-base md:text-lg max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed px-1" style={{ color: '#166534' }}>
            A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results using mobile scanning and web-based management tools.
          </p>

          <div className="flex flex-col xs:flex-row items-center justify-center gap-3 xs:gap-4">
            <button 
              onClick={() => router.push('/auth')}
              className="px-4 xs:px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl font-bold transition-all inline-flex items-center gap-2 text-xs xs:text-sm sm:text-base hover:shadow-2xl hover:scale-110 group"
              style={{ 
                background: 'linear-gradient(135deg, #166534 0%, #1a7a3e 100%)',
                color: '#FFFFFF',
                boxShadow: '0 8px 24px rgba(22, 101, 52, 0.4)'
              }}
            >
              <Sparkles className="w-4 h-4 xs:w-5 xs:h-5 group-hover:rotate-12 transition-transform" />
              <span>Start Now - It's Free</span>
              <ArrowRight className="w-4 h-4 xs:w-5 xs:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button 
              onClick={() => document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-4 xs:px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-semibold transition-all inline-flex items-center gap-2 text-xs xs:text-sm sm:text-base hover:shadow-lg"
              style={{ 
                background: 'rgba(22, 101, 52, 0.05)',
                border: '2px solid rgba(179, 139, 0, 0.3)',
                color: '#166534'
              }}
            >
              Learn More
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(30px, -30px) rotate(5deg); }
            66% { transform: translate(-20px, 20px) rotate(-5deg); }
          }
          
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </section>



      {/* Benefits Section */}
      <section id="benefits" className="py-8 xs:py-12 sm:py-16 md:py-20 px-2 xs:px-3 sm:px-4 lg:px-6 relative" style={{ 
        background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.05) 0%, rgba(254, 249, 231, 1) 50%, rgba(255, 215, 0, 0.05) 100%)'
      }}>
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-6 xs:mb-8 sm:mb-12">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2 sm:mb-3" style={{ 
              background: 'linear-gradient(135deg, #166534 0%, #B38B00 50%, #FFD700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Why Choose SIA?
            </h2>
            <p className="text-xs xs:text-sm sm:text-base px-1" style={{ color: '#166534' }}>
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 xs:gap-4 sm:gap-6 mb-6 xs:mb-8 sm:mb-12">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card 
                  key={index}
                  className="p-4 xs:p-5 sm:p-6 text-center hover:shadow-2xl hover:scale-105 transition-all duration-300 group border-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9E6 100%)',
                    borderColor: '#E6D7A0',
                    boxShadow: '0 4px 12px rgba(179, 139, 0, 0.15)'
                  }}
                >
                  <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mx-auto mb-3 xs:mb-4 sm:mb-5 group-hover:scale-110 transition-transform"
                       style={{ 
                         background: 'linear-gradient(135deg, #FFD700 0%, #B38B00 100%)',
                         boxShadow: '0 4px 12px rgba(179, 139, 0, 0.3)'
                       }}>
                    <Icon className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8" style={{ color: '#FFFFFF' }} />
                  </div>
                  <h3 className="font-bold text-sm xs:text-base sm:text-lg mb-2 xs:mb-2.5 sm:mb-3" style={{ 
                    background: 'linear-gradient(135deg, #166534 0%, #B38B00 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>{benefit.title}</h3>
                  <p className="text-xs sm:text-sm line-clamp-3" style={{ color: '#166534' }}>
                    {benefit.description}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Key Features List */}
          <Card className="p-4 xs:p-5 sm:p-6 border-2 relative overflow-hidden" style={{ 
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9E6 100%)',
            borderColor: '#E6D7A0',
            boxShadow: '0 8px 24px rgba(179, 139, 0, 0.15)'
          }}>
            <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10" style={{
              background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)'
            }}></div>
            
            <h3 className="font-bold text-base xs:text-lg sm:text-xl mb-4 xs:mb-5 sm:mb-6 flex items-center gap-2" style={{ 
              background: 'linear-gradient(135deg, #166534 0%, #B38B00 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #B38B00 100%)' }}>
                <Shield className="w-4 h-4 xs:w-5 xs:h-5" style={{ color: '#FFFFFF' }} />
              </div>
              Key Capabilities
            </h3>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 xs:gap-3.5 sm:gap-4">
              {[
                'Mobile scanning with instant feedback',
                'Automatic Student ID validation',
                'Multi-format export (Excel, CSV, PDF)',
                'Faculty dashboard with detailed analytics',
                'Paper-based exam workflow support',
                'Secure data storage and encryption',
                'Unrecognized ID flagging',
                'Institutional branding support'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg hover:shadow-md transition-all" style={{
                  background: 'rgba(255, 215, 0, 0.05)'
                }}>
                  <div className="p-1 rounded-full" style={{ background: 'linear-gradient(135deg, #B38B00 0%, #FFD700 100%)' }}>
                    <CheckCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4" style={{ color: '#FFFFFF' }} />
                  </div>
                  <span className="text-xs xs:text-sm font-medium flex-1" style={{ color: '#166534' }}>{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 xs:py-10 sm:py-12 md:py-16 px-2 xs:px-3 sm:px-4 lg:px-6 relative overflow-hidden" style={{ 
        background: 'linear-gradient(135deg, #166534 0%, #1a7a3e 50%, #B38B00 100%)'
      }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full" style={{
            background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)',
            animation: 'float 15s ease-in-out infinite'
          }}></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full" style={{
            background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)',
            animation: 'float 20s ease-in-out infinite reverse'
          }}></div>
        </div>

        <div className="w-full max-w-4xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 xs:gap-5 sm:gap-6">
            <div className="text-center sm:text-left px-1">
              <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1.5 sm:mb-2 leading-tight" style={{ color: '#FEF9E7' }}>
                Streamline Your Grading Process
              </h2>
              <p className="text-xs xs:text-sm sm:text-base font-medium" style={{ color: 'rgba(255, 215, 0, 0.9)' }}>
                Focus on teaching. Let SIA handle the grading. ✨
              </p>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="px-4 xs:px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl font-bold transition-all flex-shrink-0 w-full xs:w-auto sm:w-auto inline-flex items-center justify-center gap-2 text-xs xs:text-sm sm:text-base hover:shadow-2xl hover:scale-110 group"
              style={{ 
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#166534',
                boxShadow: '0 8px 24px rgba(255, 215, 0, 0.5)'
              }}
            >
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="hidden xs:inline">Get Started Free</span>
              <span className="xs:hidden">Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}