import { createContext, useContext, useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // With HttpOnly cookies, we can't inspect the cookie.
    // Perform a lightweight auth check by calling a protected endpoint.
    (async () => {
      try {
        const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = () => {
    setIsAuthenticated(true);
    // Clear all cached queries and invalidate to refetch with new auth
    queryClient.clear();
    queryClient.invalidateQueries();
  };

  const logout = () => {
    // Server will clear cookie; client just updates state
    setIsAuthenticated(false);
    // Clear all cached queries on logout
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}