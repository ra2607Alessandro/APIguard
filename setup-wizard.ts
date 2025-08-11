const readline = require('readline');
const fs = require('fs');
const path = require('path');

async function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('🚀 API Guard Setup Wizard\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    // Check for existing .env
    if (!fs.existsSync('.env')) {
      console.log('No .env file found. Creating one...\n');
      
      console.log('To monitor GitHub repositories, you need a Personal Access Token.');
      console.log('📝 Instructions:');
      console.log('   1. Go to: https://github.com/settings/tokens');
      console.log('   2. Click "Generate new token (classic)"');
      console.log('   3. Select scopes: repo, read:org');
      console.log('   4. Copy the token\n');
      
      const token = await question(rl, 'Paste your GitHub Personal Access Token: ');
      
      if (!token || token.trim() === '') {
        console.error('❌ GitHub token is required!');
        console.log('Get one at: https://github.com/settings/tokens');
        process.exit(1);
      }
      
      // Validate token format
      if (!token.trim().startsWith('ghp_') && !token.trim().startsWith('github_pat_')) {
        console.warn('⚠️  Token format looks unusual. Make sure it\'s a valid GitHub token.');
      }
      
      const envContent = `# API Guard Configuration
GITHUB_TOKEN=${token.trim()}
DATABASE_URL=sqlite://./data/api-guard.db
EMAIL_MODE=console
JWT_SECRET=dev-secret-do-not-use-in-production
NODE_ENV=development`;
      
      fs.writeFileSync('.env', envContent);
      console.log('\n✅ Configuration saved to .env');
    } else {
      console.log('✅ .env file already exists');
    }
    
    // Create data directory
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
      console.log('✅ Data directory created');
    }
    
    // Initialize database
    console.log('\n📦 Setting up database...');
    try {
      require('child_process').execSync('npm run db:push', { stdio: 'inherit' });
      console.log('✅ Database initialized');
    } catch (dbError) {
      console.error('❌ Database setup failed:', dbError.message);
      console.log('💡 Make sure you have the database dependencies installed');
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('Next steps:');
    console.log('  1. Run "npm run dev" to start the application');
    console.log('  2. Open http://localhost:5000 in your browser');
    console.log('  3. Create your first project and add GitHub repositories');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setup();
