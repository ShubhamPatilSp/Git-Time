// GitHub API integration using Octokit
import { Octokit } from '@octokit/rest'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

export interface GitHubPushOptions {
  token: string
  repoName: string
  repoPath: string
  isPrivate: boolean
  branchName: string
  description?: string
}

export interface GitHubPushResult {
  repoUrl: string
  cloneUrl: string
  success: boolean
}

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; username?: string; email?: string }> {
  try {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.rest.users.getAuthenticated()
    return {
      valid: true,
      username: data.login,
      email: data.email || undefined,
    }
  } catch {
    return { valid: false }
  }
}

export async function pushToGitHub(options: GitHubPushOptions): Promise<GitHubPushResult> {
  const { token, repoName, repoPath, isPrivate, branchName, description } = options
  const octokit = new Octokit({ auth: token })

  // Get authenticated user
  const { data: user } = await octokit.rest.users.getAuthenticated()

  // Create repository
  let repoData
  try {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      description: description || 'Generated with GitTime',
      auto_init: false,
    })
    repoData = data
  } catch (err: unknown) {
    // Repo might already exist
    const { data } = await octokit.rest.repos.get({
      owner: user.login,
      repo: repoName,
    })
    repoData = data
  }

  // Set remote and push
  const remoteUrl = `https://${token}@github.com/${user.login}/${repoName}.git`

  try {
    await execAsync(`git remote remove origin`, { cwd: repoPath }).catch(() => {})
    await execAsync(`git remote add origin ${remoteUrl}`, { cwd: repoPath })
    await execAsync(`git branch -M ${branchName}`, { cwd: repoPath })
    await execAsync(`git push -u origin ${branchName} --force`, { cwd: repoPath })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Push failed'
    throw new Error(`Git push failed: ${message}`)
  }

  return {
    repoUrl: repoData.html_url,
    cloneUrl: repoData.clone_url,
    success: true,
  }
}
