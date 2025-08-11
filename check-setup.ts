const fs = require('fs');
const path = require('path');

function checkSetup() {
  console.log('🔍 Checking API Guard setup...\n');
  
  let hasErrors = false;
  
  // Check .env file
  if (!fs.existsSync('.env')) {
    console.error('❌ No .env file found!');
    console.log('💡 Run "npm run setup" to create one');
    hasErrors = true;
  } else {
    console.log('✅ .env file exists');
    
    // Check GitHub token
    const envContent = fs.readFileSync('.env', 'utf8');
    if (!envContent.includes('GITHUB_TOKEN=') || 
        envContent.includes('GITHUB_TOKEN=your_token_here') ||
        envContent.includes('GITHUB_TOKEN=')) {
      console.error('❌ GitHub token not configured in .env!');
      console.log('💡 Get a token at: https://github.com/settings/tokens');
      console.log('💡 Or run "npm run setup" to configure automatically');
      hasErrors = true;
    } else {
      console.log('✅ GitHub token configured');
    }
  }
  
  // Check data directory
  if (!fs.existsSync('./data')) {
    console.log('📁 Creating data directory...');
    fs.mkdirSync('./data', { recursive: true });
    console.log('✅ Data directory created');
  } else {
    console.log('✅ Data directory exists');
  }
  
  // Check if running in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Development mode - using simplified configuration');
  }
  
  if (hasErrors) {
    console.log('\n❌ Setup incomplete. Please fix the issues above.');
    if (process.argv.includes('--no-exit')) {
      console.log('⚠️  Continuing anyway (--no-exit flag detected)');
      return;
    }
    process.exit(1);
  }
  
  console.log('\n✅ Setup check passed! Starting application...\n');
}

checkSetup();
