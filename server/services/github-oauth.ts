import { Octokit } from '@octokit/core';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { db } from '../db';
import { users, user_projects, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encryptToken, decryptToken } from './auth';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

export function getGitHubAuthURL(userId: string) {
  const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
  const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
  
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${baseUrl}/auth/github/callback`,
    scope: 'repo,user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const auth = createOAuthAppAuth({
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  });

  const tokenResponse = await auth({
    type: 'oauth-user',
    code,
  });

  return tokenResponse.token;
}

export async function getGitHubUser(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.request('GET /user');
  return user;
}

export async function getUserRepositories(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });
  const { data: repos } = await octokit.request('GET /user/repos', {
    visibility: 'all',
    sort: 'updated',
    per_page: 100,
  });
  return repos;
}

export async function saveUserGitHubToken(userId: string, accessToken: string, githubUser: any) {
  const encryptedToken = encryptToken(accessToken);
  await db
    .update(users)
    .set({ 
      github_access_token: encryptedToken,
      github_username: githubUser.login,
      github_user_id: String(githubUser.id),
      github_connected_at: new Date(),
      github_scopes: 'repo,user:email'
    })
    .where(eq(users.id, userId));
}

export async function getUserGitHubToken(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ github_access_token: users.github_access_token })
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user?.github_access_token) return null;
  return decryptToken(user.github_access_token);
}

export async function createProjectFromRepo(userId: string, repoData: any) {
  // Create project
  const [project] = await db
    .insert(projects)
    .values({
      name: repoData.name,
      github_repo: repoData.html_url,
    })
    .returning();

  // Link user to project
  await db.insert(user_projects).values({
    user_id: userId,
    project_id: project.id,
  });

  return project;
}