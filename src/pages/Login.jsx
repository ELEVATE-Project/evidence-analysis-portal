import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const usernameError = submitted && !username.trim() ? 'Username is required' : '';
  const passwordError = submitted && !password ? 'Password is required' : '';
  const isFormValid = Boolean(username.trim() && password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');

    if (!isFormValid) {
      return;
    }

    setLoading(true);

    const result = await login(username.trim(), password, rememberMe);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Evidence Analysis Portal
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={Boolean(usernameError)}
              helperText={usernameError}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={Boolean(passwordError)}
              helperText={passwordError}
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  color="primary"
                />
              )}
              label="Remember me"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !isFormValid}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Demo Credentials:
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                admin / admin123 or program_designer / user123 or analyst / user123
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
