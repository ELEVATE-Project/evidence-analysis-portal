import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Government Header */}
      <header className="bg-slate-800 border-b-4 border-amber-500">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded flex items-center justify-center border-2 border-amber-500">
              <Shield className="w-7 h-7 text-slate-800" />
            </div>
            <div>
              <h1 className="text-white text-xl font-semibold tracking-wide">
                Evidence Analysis System
              </h1>
              <p className="text-slate-300 text-sm">
                Secure Portal Access
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Login Card */}
          <Card className="border-slate-200 shadow-md">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-slate-800">Sign In</CardTitle>
              <CardDescription className="text-slate-600">
                Enter your credentials to access the portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-700 font-medium">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`${usernameError ? 'border-red-500' : 'border-slate-300'} focus:border-blue-500`}
                    autoFocus
                  />
                  {usernameError && (
                    <p className="text-sm text-red-600">{usernameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pr-10 ${passwordError ? 'border-red-500' : 'border-slate-300'} focus:border-blue-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-sm text-red-600">{passwordError}</p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-slate-600">
                    Keep me signed in
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-semibold"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing In...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Sign In
                    </span>
                  )}
                </Button>
              </form>

              {/* Demo Credentials */}
              {/* <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Testing Credentials
                </p>
                <div className="space-y-2 text-sm">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Administrator</p>
                    <p className="font-mono text-slate-800">admin / admin123</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Program Designer</p>
                    <p className="font-mono text-slate-800">program_designer / user123</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Analyst</p>
                    <p className="font-mono text-slate-800">analyst / user123</p>
                  </div>
                </div>
              </div> */}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
            <p className="text-slate-400">
              © {new Date().getFullYear()} Evidence Analysis System. All Rights Reserved.
            </p>
            <div className="flex gap-4 text-slate-400">
              <a href="#" className="hover:text-slate-200 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-200 transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-slate-200 transition-colors">Contact Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
