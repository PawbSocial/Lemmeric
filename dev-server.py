#!/usr/bin/env python3
"""
Simple development server for Lemmeric with URL rewriting support
This dev server replicates the .htaccess routing rules for local development.
Production routing should be handled by .htaccess file.
"""

import http.server
import socketserver
import urllib.parse
import re
import os
import sys
from pathlib import Path

class LemmericHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = parsed_path.query
        
        # Replicate .htaccess routing rules for development
        # Handle communities page: /communities -> communities.html
        if re.match(r'^/communities/?$', path):
            if query:
                self.path = f"/communities.html?{query}"
            else:
                self.path = "/communities.html"
            print(f"DEV: Rewriting {path} -> /communities.html")
        
        # Handle post URLs: /post/123 -> post.html?id=123
        elif re.match(r'^/post/(\d+)/?$', path):
            post_match = re.match(r'^/post/(\d+)/?$', path)
            post_id = post_match.group(1)
            new_query = f"id={post_id}"
            if query:
                new_query += f"&{query}"
            self.path = f"/post.html?{new_query}"
            print(f"DEV: Rewriting {path} -> /post.html?{new_query}")
        
        # Handle user URLs: /u/username -> user.html?username=username
        elif re.match(r'^/u/([^/?]+)/?$', path):
            user_match = re.match(r'^/u/([^/?]+)/?$', path)
            username = user_match.group(1)
            new_query = f"username={urllib.parse.quote(username)}"
            if query:
                new_query += f"&{query}"
            self.path = f"/user.html?{new_query}"
            print(f"DEV: Rewriting {path} -> /user.html?{new_query}")
        
        # Handle community URLs: /c/community_name -> community.html?name=community_name
        elif re.match(r'^/c/([^/?]+)/?$', path):
            community_match = re.match(r'^/c/([^/?]+)/?$', path)
            community_name = community_match.group(1)
            new_query = f"name={urllib.parse.quote(community_name)}"
            if query:
                new_query += f"&{query}"
            self.path = f"/community.html?{new_query}"
            print(f"DEV: Rewriting {path} -> /community.html?{new_query}")
        
        # Handle search URLs: /search -> search.html
        elif re.match(r'^/search/?$', path):
            if query:
                self.path = f"/search.html?{query}"
            else:
                self.path = "/search.html"
            print(f"DEV: Rewriting {path} -> /search.html")
        
        # Handle create post URLs: /create-post -> create_post.html
        elif re.match(r'^/create-post/?$', path):
            if query:
                self.path = f"/create_post.html?{query}"
            else:
                self.path = "/create_post.html"
            print(f"DEV: Rewriting {path} -> /create_post.html")
        
        # Handle create community URLs: /create-community -> create-community.html
        elif re.match(r'^/create-community/?$', path):
            if query:
                self.path = f"/create-community.html?{query}"
            else:
                self.path = "/create-community.html"
            print(f"DEV: Rewriting {path} -> /create-community.html")
        
        # Handle inbox URLs: /inbox -> inbox.html
        elif re.match(r'^/inbox/?$', path):
            if query:
                self.path = f"/inbox.html?{query}"
            else:
                self.path = "/inbox.html"
            print(f"DEV: Rewriting {path} -> /inbox.html")
        
        # Handle settings URLs: /settings -> settings.html
        elif re.match(r'^/settings/?$', path):
            if query:
                self.path = f"/settings.html?{query}"
            else:
                self.path = "/settings.html"
            print(f"DEV: Rewriting {path} -> /settings.html")
        
        # Handle root path
        elif path == '/':
            self.path = '/index.html'
        
        # Call the parent class to handle the request
        super().do_GET()
    
    def end_headers(self):
        # Add CORS headers for development (not needed in production)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number. Using default port 8000.")
    
    # Change to the directory containing this script
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", port), LemmericHTTPRequestHandler) as httpd:
        print(f"Lemmeric development server running at http://localhost:{port}")
        print("Development URL rewriting enabled (mirrors .htaccess rules):")
        print("  /communities -> communities.html")
        print("  /post/123 -> post.html?id=123")
        print("  /u/username -> user.html?username=username")
        print("  /c/community_name -> community.html?name=community_name")
        print("  /search -> search.html")
        print("  /create-post -> create_post.html")
        print("  /create-community -> create-community.html")
        print("  /inbox -> inbox.html")
        print("  /settings -> settings.html")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main() 