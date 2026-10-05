import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    student_id: '',
    academic_year: '',
    department: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { email, password, full_name, student_id, academic_year, department } = formData;
    const { error } = await register(email, password, {
      full_name,
      student_id,
      academic_year,
      department
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Supabase auto logs in on register if email confirmations are off.
      // If email confirmations are ON, we might need a message to check email.
      // Assuming auto-login here.
      navigate('/onboarding/sign');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <h2>Register</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="text" name="full_name" placeholder="Full Legal Name" onChange={handleChange} required />
        <input type="text" name="student_id" placeholder="Student ID (e.g. EG/2022/5311)" onChange={handleChange} required />
        <input type="text" name="academic_year" placeholder="Academic Year (e.g. 2022)" onChange={handleChange} required />
        <input type="text" name="department" placeholder="Department" onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email" onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
        <button type="submit" disabled={loading}>Register</button>
      </form>
      <p>Already have an account? <Link to="/login">Login here</Link></p>
    </div>
  );
};

export default Register;
