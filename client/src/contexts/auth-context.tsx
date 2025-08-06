import { createContext, useContext, useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("auth-token");
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem("auth-token", newToken);
    setToken(newToken);
    setIsAuthenticated(true);
    // Clear all cached queries and refetch data with new auth
    queryClient.clear();
  };

  const logout = () => {
    localStorage.removeItem("auth-token");
    setToken(null);
    setIsAuthenticated(false);
    // Clear all cached queries on logout
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, isLoading, login, logout }}>
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