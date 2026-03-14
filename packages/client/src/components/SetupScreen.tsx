import React, { useState } from 'react';
import type { AuthStatusPayload } from '@theater/shared';

interface Props {
  authStatus: AuthStatusPayload;
  onSendApiKey: (key: string) => void;
  onCheckOAuth: () => void;
}

type Step = 'choose' | 'apikey' | 'oauth';

export function SetupScreen({ authStatus, onSendApiKey, onCheckOAuth }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleApiKeySubmit = () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      setError('올바른 Anthropic API Key 형식이 아닙니다. (sk-ant- 로 시작해야 합니다)');
      return;
    }
    setError('');
    setSubmitting(true);
    onSendApiKey(trimmed);
  };

  const handleOAuthCheck = () => {
    setSubmitting(true);
    onCheckOAuth();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(8, 8, 20, 0.97)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: 'rgba(15, 15, 35, 0.95)',
        border: '1px solid rgba(74, 144, 217, 0.3)',
        borderRadius: '16px',
        padding: '40px',
        width: '480px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎭</div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: 700 }}>
            Claude Gather.town
          </h1>
          <p style={{ margin: '8px 0 0', color: '#888', fontSize: '13px' }}>
            시작하려면 인증 방법을 선택하세요
          </p>
        </div>

        {/* Step: choose */}
        {step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setStep('oauth')}
              style={{
                background: 'linear-gradient(135deg, rgba(74,144,217,0.15), rgba(74,144,217,0.05))',
                border: '1px solid rgba(74,144,217,0.4)',
                borderRadius: '10px',
                padding: '18px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#fff',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#4A90D9'; e.currentTarget.style.background = 'rgba(74,144,217,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,144,217,0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,144,217,0.15), rgba(74,144,217,0.05))'; }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🤖 Claude Code 사용</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                Claude Code CLI 설치 후 <code style={{ color: '#4A90D9' }}>claude login</code> 으로 인증
              </div>
            </button>

            <button
              onClick={() => setStep('apikey')}
              style={{
                background: 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(46,204,113,0.05))',
                border: '1px solid rgba(46,204,113,0.4)',
                borderRadius: '10px',
                padding: '18px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#fff',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.background = 'rgba(46,204,113,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(46,204,113,0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(46,204,113,0.05))'; }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔑 Anthropic API Key 사용</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                console.anthropic.com 에서 발급한 API Key 입력
              </div>
            </button>
          </div>
        )}

        {/* Step: oauth */}
        {step === 'oauth' && (
          <div>
            <button onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 0 16px', fontSize: '12px' }}>
              ← 뒤로
            </button>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '13px', color: '#ccc', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '8px', color: '#4A90D9', fontWeight: 700 }}>Claude Code 설치 방법</div>
              <div>1. Node.js 18+ 설치</div>
              <div>2. <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>npm install -g @anthropic-ai/claude-code</code></div>
              <div>3. <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>claude login</code> 실행 후 브라우저에서 인증</div>
            </div>
            {!authStatus.claudeInstalled && (
              <div style={{ color: '#e94560', fontSize: '12px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(233,69,96,0.1)', borderRadius: '6px' }}>
                ⚠️ Claude Code CLI가 설치되지 않았습니다. 위 절차를 먼저 완료하세요.
              </div>
            )}
            <button
              onClick={handleOAuthCheck}
              disabled={submitting}
              style={{
                width: '100%', padding: '12px', background: '#4A90D9',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontSize: '14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? '확인 중...' : '✅ claude login 완료했습니다'}
            </button>
          </div>
        )}

        {/* Step: apikey */}
        {step === 'apikey' && (
          <div>
            <button onClick={() => { setStep('choose'); setError(''); setApiKey(''); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 0 16px', fontSize: '12px' }}>
              ← 뒤로
            </button>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#aaa' }}>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#4A90D9' }}>
                console.anthropic.com
              </a>
              {' '}에서 API Key를 발급받으세요.
            </div>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApiKeySubmit()}
              style={{
                width: '100%', padding: '12px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', color: '#fff', fontSize: '14px', marginBottom: '8px',
                outline: 'none',
              }}
              autoFocus
            />
            {error && (
              <div style={{ color: '#e94560', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
            )}
            <button
              onClick={handleApiKeySubmit}
              disabled={submitting || !apiKey.trim()}
              style={{
                width: '100%', padding: '12px', background: '#2ecc71',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontSize: '14px', fontWeight: 700,
                cursor: submitting || !apiKey.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting || !apiKey.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? '저장 중...' : '🔑 API Key 저장'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
          Claude Gather.town — AI 에이전트 시각화 도구
        </div>
      </div>
    </div>
  );
}
