#!/usr/bin/env bun
/**
 * Setup script for first-time users
 * Creates initial admin user and API key
 */

import { auth } from '../src/auth';
import { initializeDatabase } from '../src/database/initialize';

console.log('🚀 Setting up MCP Mesh...\n');

// Initialize database
await initializeDatabase();

// Create admin user
console.log('📧 Creating admin user...');
try {
  const user = await auth.api.createUser({
    body: {
      email: 'admin@localhost',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin',
    }
  });
  
  console.log('✅ Admin user created:');
  console.log('   Email: admin@localhost');
  console.log('   Password: admin123');
  console.log('   Role: admin');
  console.log('   ID:', user.id);
  
  // Create an API key for the admin
  console.log('\n🔑 Creating API key...');
  const apiKey = await auth.api.createAPIKey({
    body: {
      userId: user.id,
      name: 'Admin API Key',
      permissions: {
        'mcp': ['*'],  // Full access to organization tools
      },
      expiresIn: 60 * 60 * 24 * 365, // 1 year
    }
  });
  
  console.log('✅ API key created:');
  console.log('   Key:', apiKey.key);
  console.log('   Name:', apiKey.name);
  console.log('\n🎉 Setup complete! You can now:');
  console.log('   1. Sign in at http://localhost:3000 with admin@localhost / admin123');
  console.log(`   2. Use the API with: Authorization: Bearer ${apiKey.key}`);
  console.log('\n⚠️  Remember to change the admin password in production!');
  
} catch (error: any) {
  if (error.message?.includes('already exists')) {
    console.log('ℹ️  Admin user already exists. Skipping...');
  } else {
    console.error('❌ Error creating admin user:', error.message);
  }
}

process.exit(0);
