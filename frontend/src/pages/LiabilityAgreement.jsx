import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const LiabilityAgreement = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [signName, setSignName] = useState('');
  const [signId, setSignId] = useState('');
  const [error, setError] = useState(null);
  
  const contentRef = useRef(null);

  useEffect(() => {
    fetchActiveProcedure();
  }, []);

  const fetchActiveProcedure = async () => {
    try {
      const { data, error } = await supabase
        .from('procedure_versions')
        .select('*')
        .eq('active', true)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error("No active procedure found.");
      
      setProcedure(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load operational procedures.");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Allow a small threshold of 5px for browser quirks
    if (scrollHeight - scrollTop - clientHeight < 5) {
      setScrolled(true);
    }
  };

  const handleSign = async () => {
    if (signName !== profile.full_name) {
      setError("Name must match your registered full name exactly.");
      return;
    }
    if (signId !== profile.student_id) {
      setError("Student ID must match your registered ID exactly.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the secure Postgres function to handle signing, audit log, and status upgrade
      const { error: rpcError } = await supabase.rpc('sign_liability', {
        p_procedure_version_id: procedure.id,
        p_signed_name: signName,
        p_signed_student_id: signId,
        p_ip_address: 'client-ip' // Ideally captured via Edge Function or headers if needed
      });

      if (rpcError) throw rpcError;

      // Refresh local profile to get new status
      await refreshProfile();
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while signing.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading procedures...</div>;
  if (!procedure) return <div>{error}</div>;

  const isFormValid = scrolled && signName.length > 0 && signId.length > 0;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <h2>Operational Agreement</h2>
      <p>Please read the full procedures below. You must scroll to the bottom to agree.</p>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div 
        ref={contentRef}
        onScroll={handleScroll}
        style={{ 
          height: '300px', 
          overflowY: 'scroll', 
          border: '1px solid #ccc', 
          padding: '10px',
          marginBottom: '20px',
          whiteSpace: 'pre-wrap'
        }}
      >
        {procedure.content || "No text content available. Please refer to document: " + procedure.document_url}
        <br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>
        (Scroll down to continue...)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: scrolled ? 1 : 0.5 }}>
        <input 
          type="text" 
          placeholder="Full Legal Name" 
          value={signName} 
          onChange={e => setSignName(e.target.value)} 
          disabled={!scrolled}
        />
        <small>Must match: {profile?.full_name}</small>

        <input 
          type="text" 
          placeholder="Student ID" 
          value={signId} 
          onChange={e => setSignId(e.target.value)} 
          disabled={!scrolled}
        />
        <small>Must match: {profile?.student_id}</small>

        <button 
          onClick={handleSign} 
          disabled={!isFormValid || loading}
        >
          I have read and agree to the Operational Procedures
        </button>
      </div>
    </div>
  );
};

export default LiabilityAgreement;
