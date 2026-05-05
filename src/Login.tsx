import React, { useState } from 'react';
import { Lock, Shield, ArrowRight, Activity } from 'lucide-react';

interface LoginProps {
  onLogin: (password: string) => void;
  error?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="login-overlay">
      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="login-icon-box">
            <Activity size={32} color="var(--accent-color)" className="pulse" />
          </div>
          <h1>Bazaar<span>Tracker</span></h1>
          <p>Secure Fusion Dashboard Access</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input
              type="password"
              placeholder="Enter Access Key..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="login-error">
              <Shield size={14} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="login-button">
            Unlock Dashboard
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-footer">
          <p>© 2024 Fusion Engine • Premium Market Intelligence</p>
        </div>
      </div>

      <style>{`
        .login-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at center, #0a0d14 0%, #05070a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 3rem 2.5rem;
          text-align: center;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header h1 {
          font-size: 2rem;
          margin: 1rem 0 0.5rem;
          letter-spacing: -1px;
        }

        .login-header h1 span {
          color: var(--accent-color);
        }

        .login-header p {
          color: var(--text-secondary);
          font-size: 0.95rem;
          margin-bottom: 2.5rem;
        }

        .login-icon-box {
          width: 64px;
          height: 64px;
          background: rgba(0, 229, 255, 0.1);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          border: 1px solid rgba(0, 229, 255, 0.2);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .input-group {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        .input-group input {
          width: 100%;
          padding: 1rem 1rem 1rem 3rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .input-group input:focus {
          outline: none;
          border-color: var(--accent-color);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 0 4px rgba(0, 229, 255, 0.1);
        }

        .login-button {
          padding: 1rem;
          background: var(--accent-color);
          color: #05070a;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s;
        }

        .login-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 8px 20px rgba(0, 229, 255, 0.3);
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #f85149;
          font-size: 0.85rem;
          justify-content: center;
          background: rgba(248, 81, 73, 0.1);
          padding: 0.75rem;
          border-radius: 8px;
        }

        .login-footer {
          margin-top: 3rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Login;
