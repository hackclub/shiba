import os
import time
import threading
import signal
import sys
import atexit
import psutil
import json
from datetime import datetime
from flask import Flask, jsonify
from dotenv import load_dotenv

# Import the sync logic from main
from main import (
    fetch_all_posts,
    group_posts_by_github_url,
    analyze_repo_for_posts,
    update_post_git_changes,
    cleanup_git_processes,
    aggressive_cleanup_git_processes,
    nuclear_cleanup_git_processes,
    docker_nuclear_cleanup,
    ultra_aggressive_cleanup,
    AIRTABLE_API_KEY,
    AIRTABLE_BASE_ID
)

load_dotenv()

app = Flask(__name__)
PORT = int(os.environ.get('PORT', 3002))

# Global sync state
is_sync_running = False
last_sync_time = None
last_sync_result = None
sync_error = None
sync_count = 0

PID_FILE = 'gitSync.pid'




def check_existing_process():
    """Check if another instance is already running."""
    try:
        if os.path.exists(PID_FILE):
            with open(PID_FILE, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process is still running
            try:
                os.kill(pid, 0)  # This will raise an exception if process doesn't exist
                print(f"Another gitSync instance is already running (PID: {pid})")
                print("Exiting to prevent conflicts...")
                sys.exit(1)
            except (OSError, ProcessLookupError):
                # Process doesn't exist, remove stale PID file
                os.remove(PID_FILE)
                print("Removed stale PID file")
    except Exception as e:
        print(f"Warning: Could not check existing process: {e}")


def save_pid():
    """Save current process ID."""
    try:
        with open(PID_FILE, 'w') as f:
            f.write(str(os.getpid()))
    except Exception as e:
        print(f"Warning: Could not save PID: {e}")


def cleanup_pid():
    """Remove PID file on exit."""
    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    except Exception as e:
        print(f"Warning: Could not remove PID file: {e}")


def cleanup_all_zombies():
    """Aggressively clean up all zombie processes."""
    print("\n  Cleaning up zombie processes...")
    try:
        # Clean up git processes
        cleanup_git_processes()
        
        # Also clean up any other zombie processes
        zombies_cleaned = 0
        for proc in psutil.process_iter(['pid', 'name', 'status']):
            try:
                if proc.info['status'] == psutil.STATUS_ZOMBIE:
                    print(f"  Found zombie process: PID {proc.info['pid']} ({proc.info['name']})")
                    zombies_cleaned += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        if zombies_cleaned > 0:
            print(f"  Cleaned up {zombies_cleaned} zombie processes")
        else:
            print("  No zombie processes found")
            
    except Exception as e:
        print(f"  Error during cleanup: {e}")


def signal_handler(signum, frame):
    """Handle shutdown signals to cleanup processes."""
    print(f"\nReceived signal {signum}, cleaning up...")
    cleanup_all_zombies()
    sys.exit(0)


def periodic_cleanup():
    """Periodically clean up zombie processes during operation."""
    while True:
        time.sleep(30)  # Check every 30 seconds
        try:
            cleanup_all_zombies()
        except Exception as e:
            print(f"Error in periodic cleanup: {e}")


def perform_full_sync():
    """Perform a full sync of posts and git changes."""
    global last_sync_result, sync_error
    
    if not AIRTABLE_API_KEY:
        raise ValueError("AIRTABLE_API_KEY environment variable is not set")
    
    if not AIRTABLE_BASE_ID:
        raise ValueError("AIRTABLE_BASE_ID environment variable is not set")
    
    # Clean up any hanging git processes before starting
    cleanup_git_processes()
    
    print(f"\n{'='*80}")
    print(f"Starting sync #{sync_count + 1} at {datetime.now().isoformat()}")
    print(f"{'='*80}\n")
    
    # Fetch posts
    posts = fetch_all_posts()
    print(f"Total posts fetched: {len(posts)}")
    
    if len(posts) == 0:
        return {
            'success': True,
            'message': 'No posts to process',
            'total_posts': 0,
            'repos_processed': 0,
            'timestamp': datetime.now().isoformat()
        }
    
    # Group by GitHub URL
    grouped_data = group_posts_by_github_url(posts)
    print(f"Grouped into {len(grouped_data)} unique repositories\n")
    
    repos_processed = 0
    posts_updated = 0
    
    # Process each repository
    for i, repo in enumerate(grouped_data, 1):
        print(f"Repository {i}/{len(grouped_data)}: {repo['github_url']}")
        print(f"  Posts: {len(repo['posts'])}")
        
        # Clean up zombies before processing each repository
        cleanup_git_processes()
        
        try:
            # Analyze repo and get git changes
            repo['posts'] = analyze_repo_for_posts(repo['github_url'], repo['posts'])
            
            # Update Airtable with git changes
            for post in repo['posts']:
                if post.get('git_changes'):
                    print(f"  Updating Airtable for post {post['post_id']}...")
                    if update_post_git_changes(post['record_id'], post['git_changes']):
                        posts_updated += 1
            
            repos_processed += 1
            
            # Ultra aggressive cleanup after each repository to prevent accumulation
            print(f"  Ultra aggressive cleanup after repo {i}...")
            ultra_aggressive_cleanup()
            
        except Exception as e:
            print(f"  Error processing repo: {e}")
            # Still clean up zombies even on error
            ultra_aggressive_cleanup()
            continue
    
    result = {
        'success': True,
        'total_posts': len(posts),
        'repos_processed': repos_processed,
        'posts_updated': posts_updated,
        'timestamp': datetime.now().isoformat()
    }
    
    print(f"\n{'='*80}")
    print(f"Sync complete: {repos_processed} repos, {posts_updated} posts updated")
    print(f"{'='*80}\n")
    
    # Clean up any hanging git processes after sync
    print("  Final ultra aggressive cleanup after full sync...")
    ultra_aggressive_cleanup()
    
    return result




def run_full_sync_and_restart():
    """Run a full sync of all repositories and then restart the server."""
    global is_sync_running, last_sync_time, last_sync_result, sync_error, sync_count
    
    is_sync_running = True
    sync_count += 1
    
    try:
        print(f"\n{'='*80}")
        print(f"Starting full sync #{sync_count} at {datetime.now().isoformat()}")
        print(f"{'='*80}\n")
        
        result = perform_full_sync()
        last_sync_result = result
        last_sync_time = datetime.now()
        sync_error = None
        
        print(f"\n{'='*80}")
        print(f"Full sync #{sync_count} completed successfully!")
        print(f"Restarting to prevent zombie accumulation...")
        print(f"{'='*80}\n")
        
        # Clean up before restart
        cleanup_all_zombies()
        
        # Wait to ensure cleanup completes
        time.sleep(60)
        
        print(f"Restarting server...")
        # Restart the server
        os.execv(sys.executable, [sys.executable] + sys.argv)
        
    except Exception as error:
        sync_error = str(error)
        print(f"❌ Full sync #{sync_count} failed: {error}")
        print(f"Restarting to prevent zombie accumulation...")
        
        # Clean up before restart even on error
        cleanup_all_zombies()
        
        # Wait to ensure cleanup completes
        time.sleep(30)
        
        print(f"Restarting server...")
        # Restart the server
        os.execv(sys.executable, [sys.executable] + sys.argv)
    
    finally:
        is_sync_running = False


# Routes
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/sync-status', methods=['GET'])
def sync_status():
    """Get sync status."""
    return jsonify({
        'is_running': is_sync_running,
        'last_sync_time': last_sync_time.isoformat() if last_sync_time else None,
        'last_sync_result': last_sync_result,
        'last_error': sync_error,
        'sync_count': sync_count,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/sync', methods=['POST'])
def trigger_sync():
    """Manually trigger a sync."""
    global is_sync_running
    
    if is_sync_running:
        return jsonify({
            'message': 'Sync already running',
            'last_sync_time': last_sync_time.isoformat() if last_sync_time else None
        }), 409
    
    try:
        result = perform_full_sync()
        return jsonify(result)
    except Exception as error:
        return jsonify({
            'success': False,
            'error': str(error),
            'timestamp': datetime.now().isoformat()
        }), 500


@app.route('/', methods=['GET'])
def root():
    """Root endpoint."""
    return jsonify({
        'service': 'gitSync',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'sync_status': '/api/sync-status',
            'trigger_sync': '/api/sync (POST)'
        }
    })


if __name__ == '__main__':
    # Check for existing process
    check_existing_process()
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    try:
        signal.signal(signal.SIGHUP, signal_handler)
    except AttributeError:
        # SIGHUP not available on Windows
        pass
    
    # Register cleanup on exit
    atexit.register(cleanup_all_zombies)
    atexit.register(cleanup_pid)
    
    # Save current PID
    save_pid()
    
    print(f"Starting gitSync server on port {PORT}")
    print(f"Full sync enabled (will restart after completing all repositories)")
    print(f"Signal handlers registered for graceful shutdown")
    
    # Initial cleanup
    cleanup_all_zombies()
    
    # Start Flask server first
    print("Starting Flask server...")
    flask_thread = threading.Thread(target=lambda: app.run(host='0.0.0.0', port=PORT), daemon=True)
    flask_thread.start()
    
    # Wait a moment for Flask to start
    time.sleep(3)
    
    # Start full sync cycle in background thread (will restart after full sync)
    print("Starting sync thread...")
    sync_thread = threading.Thread(target=run_full_sync_and_restart, daemon=True)
    sync_thread.start()
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        cleanup_all_zombies()
        cleanup_pid()
        sys.exit(0)



