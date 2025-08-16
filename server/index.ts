import express, { type Request, Response, NextFunction } from "express";
import cookieParser from 'cookie-parser';
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite"; // keep only safe exports

// Environment-aware validation function
function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isCI = process.env.CI === 'true';
  const isTest = nodeEnv === 'test';

  // Required variables for GitHub OAuth functionality
  const githubOAuthVars = ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET'];
  
  // Critical variables that should always be present (except in CI)
  const criticalVars = ['TOKEN_ENCRYPTION_KEY'];
  
  // Always required variables
  const alwaysRequired = ['DATABASE_URL'];

  if (isProduction) {
    // Production requires all variables
    const required = [...githubOAuthVars, ...criticalVars, ...alwaysRequired];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing required environment variables for production: ${missing.join(', ')}`);
      console.error('Production deployment cannot continue without these variables.');
      process.exit(1);
    }
    console.log('✓ All production environment variables validated');
    return;
  }

  if (isCI || isTest) {
    // In CI/test environments, we expect test values to be provided
    // Just verify critical structure is there
    const missing = alwaysRequired.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing critical variables in ${nodeEnv}: ${missing.join(', ')}`);
      process.exit(1);
    }
    
    console.log(`✓ Environment validated for ${nodeEnv} mode`);
    
    // Log which GitHub features will be available
    const hasGitHubVars = githubOAuthVars.every(key => process.env[key]);
    if (hasGitHubVars) {
      console.log('ℹ️  GitHub OAuth integration enabled');
    } else {
      console.log('ℹ️  GitHub OAuth integration disabled (test environment)');
    }
    return;
  }

  // Development environment - warn about missing vars but don't fail
  const allVars = [...githubOAuthVars, ...criticalVars, ...alwaysRequired];
  const missing = allVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('   Some features may not work properly.');
    console.warn('   Copy .env.example to .env and configure required variables.');
  } else {
    console.log('✓ All environment variables present');
  }
}

// Validate environment on startup
validateEnv();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Don't expose internal error details in production
      const isProduction = process.env.NODE_ENV === 'production';
      const safeMessage = isProduction && status === 500 ? "Internal Server Error" : message;

      res.status(status).json({ message: safeMessage });
      
      // Log error for debugging but don't re-throw in production
      console.error(`Error ${status}: ${message}`);
      if (!isProduction) {
        throw err;
      }
    });

    // Setup Vite in development, serve static files in production
    if (app.get("env") === "development") {
      // dynamically import dev-only code so esbuild won't bundle it for production
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      const env = process.env.NODE_ENV || 'development';
      log(`🚀 Server running on port ${port} (${env} mode)`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
