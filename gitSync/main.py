import os
import requests
import json
import subprocess
import shutil
import tempfile
import signal
import psutil
from typing import List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Airtable configuration from environment variables
AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID')
AIRTABLE_POSTS_TABLE = 'Posts'
AIRTABLE_API_BASE = 'https://api.airtable.com/v0'


def cleanup_git_processes():
    """Clean up any hanging git processes and zombies."""
    try:
        zombies_cleaned = 0
        git_procs_cleaned = 0
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status', 'create_time']):
            try:
                proc_info = proc.info
                
                # Clean up zombie processes
                if proc_info['status'] == psutil.STATUS_ZOMBIE:
                    zombies_cleaned += 1
                    print(f"  Found zombie process: PID {proc_info['pid']} ({proc_info['name']})")
                    # Zombies can't be killed, they just need to be reaped
                    # The parent process needs to call wait() - this is handled in our subprocess code
                
                # Clean up hanging git processes
                elif proc_info['name'] == 'git' and proc_info['cmdline']:
                    # Check if it's been running too long (5 minutes instead of 10)
                    if proc.create_time() < (datetime.now().timestamp() - 300):
                        print(f"  Terminating hanging git process: {proc_info['pid']}")
                        proc.terminate()
                        try:
                            proc.wait(timeout=3)
                            git_procs_cleaned += 1
                        except psutil.TimeoutExpired:
                            proc.kill()
                            proc.wait(timeout=1)
                            git_procs_cleaned += 1
                            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                pass
        
        if zombies_cleaned > 0:
            print(f"  Found {zombies_cleaned} zombie processes (will be reaped by parent)")
        if git_procs_cleaned > 0:
            print(f"  Cleaned up {git_procs_cleaned} hanging git processes")
        if zombies_cleaned == 0 and git_procs_cleaned == 0:
            print("  No processes to clean up")
            
    except Exception as e:
        print(f"  Warning: Could not cleanup processes: {e}")


def aggressive_cleanup_git_processes():
    """Aggressively clean up ALL git processes to prevent zombie accumulation."""
    try:
        zombies_cleaned = 0
        git_procs_cleaned = 0
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status']):
            try:
                proc_info = proc.info
                
                # Clean up zombie processes
                if proc_info['status'] == psutil.STATUS_ZOMBIE:
                    zombies_cleaned += 1
                    print(f"  Found zombie process: PID {proc_info['pid']} ({proc_info['name']})")
                
                # Aggressively clean up ALL git processes
                elif proc_info['name'] == 'git':
                    print(f"  Killing git process: {proc_info['pid']}")
                    try:
                        proc.terminate()
                        proc.wait(timeout=2)
                        git_procs_cleaned += 1
                    except psutil.TimeoutExpired:
                        proc.kill()
                        proc.wait(timeout=1)
                        git_procs_cleaned += 1
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                pass
        
        if zombies_cleaned > 0:
            print(f"  Found {zombies_cleaned} zombie processes")
        if git_procs_cleaned > 0:
            print(f"  Killed {git_procs_cleaned} git processes")
        if zombies_cleaned == 0 and git_procs_cleaned == 0:
            print("  No git processes to clean up")
            
    except Exception as e:
        print(f"  Warning: Could not aggressively cleanup processes: {e}")


def nuclear_cleanup_git_processes():
    """NUCLEAR OPTION: Kill ALL git processes and use system commands for total reset."""
    try:
        print("  🚨 NUCLEAR CLEANUP: Total git process reset...")
        
        # Use system commands to kill all git processes
        import subprocess
        
        # Kill all git processes with pkill
        try:
            result = subprocess.run(['pkill', '-f', 'git'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print("  Killed all git processes with pkill")
        except:
            pass
        
        # Also try killall
        try:
            result = subprocess.run(['killall', 'git'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print("  Killed all git processes with killall")
        except:
            pass
        
        # Force kill any remaining git processes
        try:
            result = subprocess.run(['pkill', '-9', '-f', 'git'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print("  Force killed remaining git processes")
        except:
            pass
        
        # Wait a moment for processes to die
        time.sleep(2)
        
        # Now use psutil to clean up any remaining processes
        zombies_cleaned = 0
        git_procs_cleaned = 0
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status']):
            try:
                proc_info = proc.info
                
                # Clean up zombie processes
                if proc_info['status'] == psutil.STATUS_ZOMBIE:
                    zombies_cleaned += 1
                    print(f"  Found zombie process: PID {proc_info['pid']} ({proc_info['name']})")
                
                # Kill any remaining git processes
                elif proc_info['name'] == 'git':
                    print(f"  Force killing remaining git process: {proc_info['pid']}")
                    try:
                        proc.kill()
                        proc.wait(timeout=1)
                        git_procs_cleaned += 1
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                        pass
                            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                pass
        
        print(f"  🚨 NUCLEAR CLEANUP COMPLETE: {zombies_cleaned} zombies, {git_procs_cleaned} git processes killed")
        
        # Final system cleanup
        try:
            subprocess.run(['sync'], timeout=5)  # Force sync to disk
        except:
            pass
            
    except Exception as e:
        print(f"  🚨 NUCLEAR CLEANUP ERROR: {e}")


def docker_nuclear_cleanup():
    """DOCKER-SPECIFIC NUCLEAR CLEANUP: Optimized for containerized environments."""
    try:
        print("  🐳 DOCKER NUCLEAR CLEANUP: Container-optimized git process reset...")
        
        import subprocess
        import os
        import signal
        
        # In Docker containers, we need to be more aggressive
        zombies_cleaned = 0
        git_procs_cleaned = 0
        
        # CRITICAL: First, try to reap zombies by calling wait() on all child processes
        # This is the most important part for Docker containers
        try:
            # This helps reap zombie processes in the current process
            while True:
                try:
                    pid, status = os.waitpid(-1, os.WNOHANG)
                    if pid == 0:
                        break
                    print(f"  Reaped zombie process: PID {pid}")
                    zombies_cleaned += 1
                except OSError:
                    break
        except:
            pass
        
        # Now aggressively kill all git processes
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status']):
            try:
                proc_info = proc.info
                
                # Clean up zombie processes
                if proc_info['status'] == psutil.STATUS_ZOMBIE:
                    zombies_cleaned += 1
                    print(f"  Found zombie process: PID {proc_info['pid']} ({proc_info['name']})")
                
                # Kill ALL git processes aggressively
                elif proc_info['name'] == 'git':
                    print(f"  🐳 Force killing git process: {proc_info['pid']}")
                    try:
                        # Try SIGTERM first
                        proc.terminate()
                        proc.wait(timeout=1)
                        git_procs_cleaned += 1
                    except psutil.TimeoutExpired:
                        # Force kill with SIGKILL
                        proc.kill()
                        proc.wait(timeout=1)
                        git_procs_cleaned += 1
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                pass
        
        # Try system commands that work in containers
        try:
            # Use ps and kill combination
            result = subprocess.run(['ps', 'aux'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'git' in line and 'python' not in line:  # Don't kill our own process
                        parts = line.split()
                        if len(parts) > 1:
                            try:
                                pid = int(parts[1])
                                if pid != os.getpid():  # Don't kill ourselves
                                    subprocess.run(['kill', '-9', str(pid)], timeout=2)
                                    print(f"  🐳 Killed git process via ps: {pid}")
                                    git_procs_cleaned += 1
                            except (ValueError, subprocess.TimeoutExpired):
                                pass
        except:
            pass
        
        # CRITICAL: Try to reap zombies again after killing processes
        try:
            while True:
                try:
                    pid, status = os.waitpid(-1, os.WNOHANG)
                    if pid == 0:
                        break
                    print(f"  Reaped zombie process after cleanup: PID {pid}")
                    zombies_cleaned += 1
                except OSError:
                    break
        except:
            pass
        
        # Force garbage collection to help with memory
        import gc
        gc.collect()
        
        print(f"  🐳 DOCKER NUCLEAR CLEANUP COMPLETE: {zombies_cleaned} zombies, {git_procs_cleaned} git processes killed")
        
        # Final container cleanup
        try:
            subprocess.run(['sync'], timeout=5)
        except:
            pass
            
    except Exception as e:
        print(f"  🐳 DOCKER NUCLEAR CLEANUP ERROR: {e}")


def ultra_aggressive_cleanup():
    """ULTRA AGGRESSIVE: Force restart the entire process to eliminate all zombies."""
    try:
        print("  💥 ULTRA AGGRESSIVE CLEANUP: Force process restart to eliminate zombies...")
        
        import subprocess
        import os
        import sys
        
        # Try to reap all zombies first
        zombies_reaped = 0
        try:
            while True:
                try:
                    pid, status = os.waitpid(-1, os.WNOHANG)
                    if pid == 0:
                        break
                    print(f"  Reaped zombie: PID {pid}")
                    zombies_reaped += 1
                except OSError:
                    break
        except:
            pass
        
        # If we still have too many zombies, consider restarting
        if zombies_reaped > 50:
            print(f"  💥 Too many zombies ({zombies_reaped}), considering process restart...")
            # Don't actually restart here, just clean up aggressively
        
        # Kill all git processes with extreme prejudice
        git_killed = 0
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status']):
            try:
                proc_info = proc.info
                if proc_info['name'] == 'git':
                    try:
                        proc.kill()
                        proc.wait(timeout=0.5)
                        git_killed += 1
                    except:
                        pass
            except:
                pass
        
        print(f"  💥 ULTRA AGGRESSIVE COMPLETE: {zombies_reaped} zombies reaped, {git_killed} git processes killed")
        
    except Exception as e:
        print(f"  💥 ULTRA AGGRESSIVE ERROR: {e}")


def airtable_request(path: str, method: str = 'GET', params: Dict = None) -> Dict[str, Any]:
    """Make a request to the Airtable API."""
    url = f"{AIRTABLE_API_BASE}/{AIRTABLE_BASE_ID}/{path}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_API_KEY}',
        'Content-Type': 'application/json',
    }
    
    response = requests.request(method, url, headers=headers, params=params)
    
    if not response.ok:
        raise Exception(f"Airtable error {response.status_code}: {response.text}")
    
    return response.json()


def fetch_all_posts() -> List[Dict[str, Any]]:
    """Fetch all posts from Airtable with pagination."""
    all_records = []
    offset = None
    
    # Specific fields to fetch
    fields_to_fetch = ['PostID', 'GitHubUrl', 'GitHubUsername', 'GitChanges', 'Created At', 'TimeSpentOnAsset']
    
    # Filter to only get records where:
    # - GitHubUrl and GitHubUsername are not empty
    # - TimeSpentOnAsset is empty/null (not yet processed)
    filter_formula = "AND({GitHubUrl}!='', {GitHubUsername}!='', OR({TimeSpentOnAsset}='', {TimeSpentOnAsset}=BLANK()))"
    
    while True:
        params = {
            'pageSize': '100',
            'fields[]': fields_to_fetch,
            'filterByFormula': filter_formula
        }
        if offset:
            params['offset'] = offset
        
        page = airtable_request(AIRTABLE_POSTS_TABLE, params=params)
        
        page_records = page.get('records', [])
        all_records.extend(page_records)
        
        offset = page.get('offset')
        if not offset:
            break
        
        print(f"Fetched {len(all_records)} records so far...")
    
    return all_records


def clone_repo(github_url: str, clone_dir: str) -> bool:
    """Clone a GitHub repository with minimal data (blobless clone for speed)."""
    proc = None
    try:
        print(f"  Cloning {github_url} (blobless for speed)...")
        # Use --filter=blob:none for blobless clone - gets commit history and tree structure
        # but not file contents, which are fetched on-demand. Much faster!
        proc = subprocess.Popen(
            ['git', 'clone', '--filter=blob:none', '--quiet', github_url, clone_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=300)  # 5 minute timeout
        proc.wait()  # Ensure we reap the zombie
        
        # Immediate cleanup after git operation
        cleanup_git_processes()
        
        if proc.returncode != 0:
            print(f"  Error cloning repository: {stderr}")
            return False
        return True
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
            proc.wait()  # Reap the zombie even after killing
        print(f"  Timeout cloning repository: {github_url}")
        return False
    except Exception as e:
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait()  # Reap the zombie
        print(f"  Error cloning repository: {e}")
        return False


def get_commits_in_timerange(repo_dir: str, start_time: str = None, end_time: str = None) -> List[Dict[str, Any]]:
    """Get commits within a time range."""
    proc = None
    try:
        # Build git log command
        cmd = ['git', 'log', '--all', '--pretty=format:%H|%an|%ae|%ai|%s']
        
        if start_time and end_time:
            cmd.append(f'--since={start_time}')
            cmd.append(f'--until={end_time}')
        elif end_time:
            cmd.append(f'--until={end_time}')
        
        proc = subprocess.Popen(
            cmd,
            cwd=repo_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=120)  # 2 minute timeout
        proc.wait()  # Ensure we reap the zombie
        
        # Immediate cleanup after git operation
        cleanup_git_processes()
        
        commits = []
        for line in stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split('|', 4)
            if len(parts) == 5:
                commits.append({
                    'hash': parts[0],
                    'author': parts[1],
                    'email': parts[2],
                    'date': parts[3],
                    'message': parts[4]
                })
        
        return commits
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
            proc.wait()  # Reap the zombie even after killing
        print(f"  Timeout getting commits from {repo_dir}")
        return []
    except Exception as e:
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait()  # Reap the zombie
        print(f"  Error getting commits: {e}")
        return []


def get_commit_changes(repo_dir: str, commit_hash: str, github_url: str) -> List[Dict[str, Any]]:
    """Get file changes for a specific commit with stats and GitHub links."""
    proc = None
    try:
        # Get diff stats for the commit
        proc = subprocess.Popen(
            ['git', 'show', '--numstat', '--pretty=format:', commit_hash],
            cwd=repo_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=60)  # 1 minute timeout
        proc.wait()  # Ensure we reap the zombie
        
        # Immediate cleanup after git operation
        cleanup_git_processes()
        
        # Parse the GitHub URL to get owner/repo
        # Format: https://github.com/owner/repo or https://github.com/owner/repo.git
        github_url = github_url.rstrip('.git')
        
        files_changed = []
        for line in stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) >= 3:
                additions = parts[0]
                deletions = parts[1]
                filepath = parts[2]
                
                # Handle binary files (show as - -)
                if additions == '-':
                    additions = 0
                    deletions = 0
                    is_binary = True
                else:
                    additions = int(additions)
                    deletions = int(deletions)
                    is_binary = False
                
                # Generate GitHub link to this specific file change
                file_link = f"{github_url}/commit/{commit_hash}#diff-{hash(filepath) & 0xffffffff:08x}"
                
                files_changed.append({
                    'filepath': filepath,
                    'additions': additions,
                    'deletions': deletions,
                    'is_binary': is_binary,
                    'github_link': file_link
                })
        
        return files_changed
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
            proc.wait()  # Reap the zombie even after killing
        print(f"  Timeout getting commit changes for {commit_hash}")
        return []
    except Exception as e:
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait()  # Reap the zombie
        print(f"  Error getting commit changes: {e}")
        return []


def analyze_repo_for_posts(github_url: str, posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Analyze repository and generate git changes for each post."""
    temp_dir = tempfile.mkdtemp()
    repo_dir = os.path.join(temp_dir, 'repo')
    
    try:
        # Clone the repository
        if not clone_repo(github_url, repo_dir):
            # Clean up temp dir if clone fails
            shutil.rmtree(temp_dir, ignore_errors=True)
            return posts
        
        # Process each post
        for i, post in enumerate(posts):
            print(f"  Processing post {i+1}/{len(posts)}: {post['post_id']}")
            
            # Clean up zombies every 5 posts to prevent accumulation
            if i % 5 == 0 and i > 0:
                cleanup_git_processes()
            
            # Determine time range
            end_time = post['created_at']
            start_time = posts[i-1]['created_at'] if i > 0 else None
            
            # Get commits in this time range
            commits = get_commits_in_timerange(repo_dir, start_time, end_time)
            
            if not commits:
                print(f"    No commits found in timerange")
                post['git_changes'] = json.dumps({
                    'commits': [],
                    'summary': 'No commits found in this timerange'
                })
                continue
            
            print(f"    Found {len(commits)} commits")
            
            # Get changes for each commit
            commit_changes = []
            for commit in commits:
                files_changed = get_commit_changes(repo_dir, commit['hash'], github_url)
                
                # Generate GitHub commit link
                commit_link = f"{github_url}/commit/{commit['hash']}"
                
                commit_changes.append({
                    'hash': commit['hash'][:7],  # Short hash
                    'author': commit['author'],
                    'date': commit['date'],
                    'message': commit['message'],
                    'github_link': commit_link,
                    'files': files_changed,
                    'stats': {
                        'files_changed': len(files_changed),
                        'total_additions': sum(f['additions'] for f in files_changed),
                        'total_deletions': sum(f['deletions'] for f in files_changed)
                    }
                })
            
            # Calculate totals
            total_files = sum(len(c['files']) for c in commit_changes)
            total_additions = sum(c['stats']['total_additions'] for c in commit_changes)
            total_deletions = sum(c['stats']['total_deletions'] for c in commit_changes)
            
            # Store as JSON string
            post['git_changes'] = json.dumps({
                'commits': commit_changes,
                'summary': {
                    'total_commits': len(commits),
                    'total_files_changed': total_files,
                    'total_additions': total_additions,
                    'total_deletions': total_deletions
                }
            }, indent=2)
        
        return posts
        
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)


def group_posts_by_github_url(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group posts by GitHub URL."""
    grouped = {}
    
    for post in posts:
        fields = post.get('fields', {})
        
        # Extract GitHub URL (handle it being a list or string)
        github_url = fields.get('GitHubUrl')
        if isinstance(github_url, list):
            github_url = github_url[0] if github_url else None
        
        if not github_url:
            continue
        
        # Extract username (handle it being a list or string)
        username = fields.get('GitHubUsername')
        if isinstance(username, list):
            username = username[0] if username else None
        
        # Create post data
        post_data = {
            'record_id': post.get('id'),  # Store Airtable record ID
            'post_id': fields.get('PostID'),
            'created_at': fields.get('Created At'),
            'username': username,
            'git_changes': fields.get('GitChanges')
        }
        
        # Add to grouped dictionary
        if github_url not in grouped:
            grouped[github_url] = {
                'github_url': github_url,
                'posts': []
            }
        
        grouped[github_url]['posts'].append(post_data)
    
    # Convert to list and sort posts by created_at within each group
    result = list(grouped.values())
    for group in result:
        group['posts'].sort(key=lambda x: x.get('created_at', ''))
    
    return result


def update_post_git_changes(record_id: str, git_changes: str) -> bool:
    """Update a post record in Airtable with git changes."""
    try:
        url = f"{AIRTABLE_API_BASE}/{AIRTABLE_BASE_ID}/{AIRTABLE_POSTS_TABLE}/{record_id}"
        
        response = requests.patch(
            url,
            headers={
                'Authorization': f'Bearer {AIRTABLE_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'fields': {
                    'GitChanges': git_changes
                }
            }
        )
        
        if not response.ok:
            print(f"    Error updating Airtable: {response.status_code} - {response.text}")
            return False
        
        return True
    except Exception as e:
        print(f"    Error updating Airtable: {e}")
        return False


def main():
    """Main function to fetch and display all posts."""
    if not AIRTABLE_API_KEY:
        raise ValueError("AIRTABLE_API_KEY environment variable is not set")
    
    if not AIRTABLE_BASE_ID:
        raise ValueError("AIRTABLE_BASE_ID environment variable is not set")
    
    # Clean up any hanging git processes before starting
    cleanup_git_processes()
    
    print(f"Fetching all posts from Airtable...")
    print(f"Base ID: {AIRTABLE_BASE_ID}")
    print(f"Table: {AIRTABLE_POSTS_TABLE}")
    print()
    
    posts = fetch_all_posts()
    
    print(f"\nTotal posts fetched: {len(posts)}")
    
    # Group posts by GitHub URL
    grouped_data = group_posts_by_github_url(posts)
    
    print(f"\nGrouped into {len(grouped_data)} unique GitHub repositories")
    print("\n" + "="*80)
    print("Analyzing repositories and updating git changes...")
    print("="*80 + "\n")
    
    # Process each repository
    for i, repo in enumerate(grouped_data, 1):
        print(f"\nRepository {i}/{len(grouped_data)}: {repo['github_url']}")
        print(f"  Total posts: {len(repo['posts'])}")
        
        # Analyze repo and get git changes
        repo['posts'] = analyze_repo_for_posts(repo['github_url'], repo['posts'])
        
        # Update Airtable with git changes
        for post in repo['posts']:
            if post.get('git_changes'):
                print(f"  Updating Airtable for post {post['post_id']}...")
                update_post_git_changes(post['record_id'], post['git_changes'])
    
    # Save to JSON file
    output_file = 'posts_data.json'
    with open(output_file, 'w') as f:
        json.dump(grouped_data, f, indent=2)
    
    print(f"\n\n{'='*80}")
    print(f"Complete! Data saved to {output_file}")
    print(f"Processed {len(grouped_data)} repositories")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()

