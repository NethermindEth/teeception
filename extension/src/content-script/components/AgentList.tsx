import React, { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAgentRegistry } from '../hooks/useAgentRegistry';
import { ChevronRight, ChevronDown, Coins, MessageSquare } from 'lucide-react';
import { CONFIG } from '../config';

export const AgentList: React.FC = () => {
  const { address: registryAddress } = useAgentRegistry();
  const { agents, loading, error } = useAgents(registryAddress);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // Sort agents by balance
  const sortedAgents = [...agents].sort((a, b) => {
    const balanceA = BigInt(a.balance);
    const balanceB = BigInt(b.balance);
    return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0;
  });

  const getBalanceColor = (index: number, total: number) => {
    // Start with bright green and fade to a more muted green
    const hue = 145; // Green hue
    const saturation = Math.max(60, 100 - (index / total) * 40); // Fade from 100% to 60%
    const lightness = Math.max(30, 60 - (index / total) * 30); // Fade from 60% to 30%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const handleMessageClick = (agent: typeof agents[0], event: React.MouseEvent) => {
    event.stopPropagation();
    
    const composerDiv = document.querySelector('[data-testid="tweetTextarea_0"]')?.closest('div[role="textbox"]') as HTMLDivElement;
    // Add terminating colon if agent name contains a space
    const needsTerminatingColon = agent.name.includes(' ');
    const agentMention = `${CONFIG.accountName}:${agent.name}${needsTerminatingColon ? ':' : ''}`;
    
    if (composerDiv) {
      // Check if mention already exists
      const currentText = composerDiv.textContent || '';
      if (currentText.includes(agentMention)) {
        return; // Skip if already mentioned
      }

      composerDiv.focus();
      
      // Move cursor to end
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composerDiv);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Add space if needed
      if (currentText && !currentText.endsWith(' ')) {
        document.execCommand('insertText', false, ' ');
      }
      
      // Insert agent mention
      document.execCommand('insertText', false, agentMention);
    } else {
      const tweetButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') as HTMLElement;
      if (tweetButton) {
        tweetButton.click();
        setTimeout(() => {
          const newComposerDiv = document.querySelector('[data-testid="tweetTextarea_0"]')?.closest('div[role="textbox"]') as HTMLDivElement;
          if (newComposerDiv) {
            newComposerDiv.focus();
            document.execCommand('insertText', false, agentMention);
          }
        }, 300);
      }
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '80px',
    right: '12px',
    width: '280px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '12px',
    padding: '16px',
    backdropFilter: 'blur(4px)',
    color: 'white',
    zIndex: 9998,
  };

  const listStyle: React.CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  const listItemStyle: React.CSSProperties = {
    borderRadius: '6px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    transition: 'all 0.2s',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    gap: '8px',
  };

  const detailsStyle: React.CSSProperties = {
    padding: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '13px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  };

  const formatBalance = (balance: string) => {
    const value = BigInt(balance);
    if (value === BigInt(0)) return '0';
    
    const decimals = 18;
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr) {
      return `${integerPart}.${fractionalStr.slice(0, 4)}`;
    }
    return integerPart.toString();
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
          Loading agents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ color: 'rgb(239, 68, 68)' }}>Failed to load agents</div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
          No agents found
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Registered Agents</h3>
      <ul style={listStyle}>
        {sortedAgents.map((agent, index) => (
          <li key={agent.address} style={listItemStyle}>
            <div 
              style={headerStyle}
              onClick={() => setExpandedAgentId(expandedAgentId === agent.address ? null : agent.address)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {expandedAgentId === agent.address ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div style={{ flex: 1 }}>{agent.name}</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <button
                  onClick={(e) => handleMessageClick(agent, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: 'white',
                    opacity: 0.6,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  title="Message this agent"
                >
                  <MessageSquare size={14} />
                </button>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: getBalanceColor(index, sortedAgents.length - 1),
                  fontWeight: 500,
                  fontSize: '13px',
                }}>
                  <Coins size={12} />
                  {formatBalance(agent.balance)}
                </div>
              </div>
            </div>
            {expandedAgentId === agent.address && (
              <div style={detailsStyle}>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', marginBottom: '2px', fontSize: '12px' }}>Address</div>
                  <div style={{ wordBreak: 'break-all' }}>{agent.address}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', marginBottom: '2px', fontSize: '12px' }}>System Prompt</div>
                  <div>{agent.systemPrompt}</div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}; 