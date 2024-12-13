import React, { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAgentRegistry } from '../hooks/useAgentRegistry';
import { X, Loader2, Coins } from 'lucide-react';

interface AgentDetailsModalProps {
  agent: {
    address: string;
    name: string;
    systemPrompt: string;
    balance: string;
  };
  onClose: () => void;
}

const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({ agent, onClose }) => {
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '90%',
    maxWidth: '500px',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
    color: 'white',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    cursor: 'pointer',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '12px',
    marginBottom: '4px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '14px',
    wordBreak: 'break-all',
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Agent Details</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'white',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={fieldStyle}>
          <div style={labelStyle}>Name</div>
          <div style={valueStyle}>{agent.name}</div>
        </div>

        <div style={fieldStyle}>
          <div style={labelStyle}>Address</div>
          <div style={valueStyle}>{agent.address}</div>
        </div>

        <div style={fieldStyle}>
          <div style={labelStyle}>Balance</div>
          <div style={valueStyle}>{agent.balance} STRK</div>
        </div>

        <div style={fieldStyle}>
          <div style={labelStyle}>System Prompt</div>
          <div style={valueStyle}>{agent.systemPrompt}</div>
        </div>
      </div>
    </>
  );
};

export const AgentList: React.FC = () => {
  const { address: registryAddress } = useAgentRegistry();
  const { agents, loading, error } = useAgents(registryAddress);
  const [selectedAgent, setSelectedAgent] = useState<typeof agents[0] | null>(null);

  // Sort agents by balance
  const sortedAgents = [...agents].sort((a, b) => {
    const balanceA = BigInt(a.balance);
    const balanceB = BigInt(b.balance);
    return balanceB > balanceA ? 1 : balanceB < balanceA ? -1 : 0;
  });

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
    padding: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const nameStyle: React.CSSProperties = {
    flex: '1',
    marginRight: '12px',
  };

  const getBalanceColor = (index: number, total: number) => {
    // Start with bright green and fade to a more muted green
    const hue = 145; // Green hue
    const saturation = Math.max(60, 100 - (index / total) * 40); // Fade from 100% to 60%
    const lightness = Math.max(30, 60 - (index / total) * 30); // Fade from 60% to 30%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>Loading agents...</span>
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

  const formatBalance = (balance: string) => {
    const value = BigInt(balance);
    if (value === BigInt(0)) return '0';
    
    // Format with 18 decimals
    const decimals = 18;
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    // Format fractional part and remove trailing zeros
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr) {
      return `${integerPart}.${fractionalStr.slice(0, 4)}`; // Show only 4 decimal places
    }
    return integerPart.toString();
  };

  return (
    <>
      <div style={containerStyle}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Agents</h3>
        <ul style={listStyle}>
          {sortedAgents.map((agent, index) => (
            <li
              key={agent.address}
              style={listItemStyle}
              onClick={() => setSelectedAgent(agent)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <div style={nameStyle}>{agent.name}</div>
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
            </li>
          ))}
        </ul>
      </div>
      {selectedAgent && (
        <AgentDetailsModal
          agent={{
            ...selectedAgent,
            balance: formatBalance(selectedAgent.balance),
          }}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </>
  );
}; 