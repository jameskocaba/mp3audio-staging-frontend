import os
import time
from datetime import datetime
from yt_dlp import YoutubeDL

# Top Platforms with Stable, Hardcoded URLs
PLATFORMS_TO_TEST = {
    # --- Major Video & Social ---
    "YouTube": {"desc": "Public videos, music tracks, Shorts, and podcasts.", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "skip_test": False},
    "Vimeo": {"desc": "Publicly accessible videos.", "url": "https://vimeo.com/76979871", "skip_test": False},
    "Instagram": {"desc": "Public Reels and video posts.", "url": "https://www.instagram.com/p/Cw9vF1XoP_o/", "skip_test": False}, 
    "Facebook": {"desc": "Publicly shared videos and Watch content.", "url": "https://www.facebook.com/facebook/videos/10153231379946729/", "skip_test": False}, 
    "Twitter / X": {"desc": "Embedded video clips and public Spaces.", "url": "https://twitter.com/Twitter/status/1363643508216172551", "skip_test": False},
    "Reddit": {"desc": "Native video and audio embeds.", "url": "https://www.reddit.com/r/videos/comments/16v8p21/", "skip_test": False},
    "Twitch": {"desc": "Public Clips and VODs.", "url": "https://www.twitch.tv/videos/431182285", "skip_test": False},
    "Dailymotion": {"desc": "Public video uploads.", "url": "https://www.dailymotion.com/video/x8l31w1", "skip_test": False},
    "Rumble": {"desc": "Public video uploads and streams.", "url": "https://rumble.com/v1i2q11-how-to-use-rumble.html", "skip_test": False},
    "Pinterest": {"desc": "Video pins and idea pins.", "url": "https://www.pinterest.com/pin/574209021251368945/", "skip_test": False},
    "LinkedIn": {"desc": "Publicly shared videos on feeds.", "url": "https://www.linkedin.com/posts/linkedin_activity-7013890251322056704-1234", "skip_test": False},
    "Snapchat": {"desc": "Public Spotlight and Story videos.", "url": "https://story.snapchat.com/p/e9c1c5b8-5374-4b47-b371-332924a18018", "skip_test": False},
    "Bilibili": {"desc": "User-generated videos and animations.", "url": "https://www.bilibili.com/video/BV1xx411c7", "skip_test": False},
    "VKontakte (VK)": {"desc": "Public video and audio uploads.", "url": "https://vk.com/video-22822305_456239018", "skip_test": False},

    # --- Audio & Music ---
    "SoundCloud": {"desc": "Individual tracks, mixes, and public playlists.", "url": "https://soundcloud.com/coleschotz/cole-schotz-sound-check", "skip_test": True},
    "Bandcamp": {"desc": "Public tracks and albums.", "url": "https://c418.bandcamp.com/track/sweden", "skip_test": False},
    "Mixcloud": {"desc": "DJ mixes, radio shows, and podcasts.", "url": "https://www.mixcloud.com/Mixcloud/mixcloud-meets-moby/", "skip_test": False},
    "Audiomack": {"desc": "Music streams and mixtapes.", "url": "https://audiomack.com/audiomack/song/audiomack-is-here", "skip_test": False},
    "ReverbNation": {"desc": "Indie music tracks.", "url": "https://www.reverbnation.com/imaginedragons/song/11186716-radioactive", "skip_test": False},
    "Apple Podcasts": {"desc": "Public, DRM-free podcast episodes.", "url": "https://podcasts.apple.com/us/podcast/the-daily/id1200361736", "skip_test": False},
    "Freesound": {"desc": "Collaborative database of audio snippets.", "url": "https://freesound.org/people/InspectorJ/sounds/352514/", "skip_test": False},
    "Hearthis.at": {"desc": "DJ mixes, tracks, and podcasts.", "url": "https://hearthis.at/dj-khalid/dj-khalid-mix/", "skip_test": False},
    "Jamendo": {"desc": "Royalty-free independent music.", "url": "https://www.jamendo.com/track/1886196/", "skip_test": False},

    # --- Education, News & Media ---
    "TED": {"desc": "TED Talks and educational lectures.", "url": "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity", "skip_test": False},
    "Khan Academy": {"desc": "Educational tutorials and course videos.", "url": "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:foundation-algebra/x2f8bb11595b61c86:algebra-overview/v/overview-of-algebra", "skip_test": False},
    "PBS": {"desc": "Public broadcasting documentaries and clips.", "url": "https://www.pbs.org/video/frontline-putins-revenge-part-two/", "skip_test": False},
    "NPR": {"desc": "National Public Radio stories and podcasts.", "url": "https://www.npr.org/2024/01/01/1222345678/example", "skip_test": False},
    "BBC": {"desc": "Public news clips and documentaries.", "url": "https://www.bbc.co.uk/news/av/uk-68000000", "skip_test": False},
    "CNN": {"desc": "News clips and video reports.", "url": "https://www.cnn.com/videos/us/2023/01/01/example.cnn", "skip_test": False},
    "Fox News": {"desc": "News reports and video segments.", "url": "https://video.foxnews.com/v/6300000000000", "skip_test": False},
    "NBC News": {"desc": "Broadcast clips and web-exclusive videos.", "url": "https://www.nbcnews.com/video/example-12345", "skip_test": False},
    "ABC News": {"desc": "News highlights and live clip archives.", "url": "https://abcnews.go.com/US/video/example-12345", "skip_test": False},
    "CBS News": {"desc": "Daily news segments and interviews.", "url": "https://www.cbsnews.com/video/example-12345/", "skip_test": False},
    "Al Jazeera": {"desc": "Global news coverage and documentaries.", "url": "https://www.aljazeera.com/program/newsfeed/2024/1/1/example", "skip_test": False},
    "Reuters": {"desc": "International news video clips.", "url": "https://www.reuters.com/video/watch/idOV123456789", "skip_test": False},
    "Bloomberg": {"desc": "Financial news and market updates.", "url": "https://www.bloomberg.com/news/videos/2024-01-01/example", "skip_test": False},
    "ESPN": {"desc": "Sports highlights and commentary clips.", "url": "https://www.espn.com/video/clip/_/id/1234567", "skip_test": False},
    "Vice": {"desc": "Documentaries and investigative reporting.", "url": "https://video.vice.com/en_us/video/example/12345", "skip_test": False},
    "The New York Times": {"desc": "Short films and journalistic videos.", "url": "https://www.nytimes.com/video/us/1000000000000/example.html", "skip_test": False},
    "The Guardian": {"desc": "Global news and feature videos.", "url": "https://www.theguardian.com/world/video/2024/jan/01/example", "skip_test": False},

    # --- Misc & Specialty ---
    "Internet Archive": {"desc": "Archived audio, video, and historical media.", "url": "https://archive.org/details/CEP114", "skip_test": False},
    "Kickstarter": {"desc": "Project pitch videos.", "url": "https://www.kickstarter.com/projects/kickstarter/kickstarter-at-10", "skip_test": False},
    "Imgur": {"desc": "GIFs with sound and short video uploads.", "url": "https://imgur.com/gallery/AW1uG2R", "skip_test": False},
    "Streamable": {"desc": "Short-form video hosting clips.", "url": "https://streamable.com/moo", "skip_test": False},
    "Odysee": {"desc": "Decentralized video hosting platform.", "url": "https://odysee.com/@Odysee:8/what-is-odysee:b", "skip_test": False},
    "Nebula": {"desc": "Creator-owned streaming service.", "url": "https://nebula.tv/videos/hai-the-logistics-of-the-us-postal-service", "skip_test": False}, 
    "Youku": {"desc": "Popular Chinese video hosting service.", "url": "https://v.youku.com/v_show/id_XNDg0MDQyMjQ4NA==.html", "skip_test": False},
    "Naver TV": {"desc": "Korean portal video content.", "url": "https://tv.naver.com/v/1234567", "skip_test": False},
    "Dzen": {"desc": "Russian infotainment video platform.", "url": "https://dzen.ru/video/watch/650000000000000000000000", "skip_test": False}
}

def check_platform(name, data):
    print(f"Testing {name}...")
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True, 
        'socket_timeout': 15,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        }
    }
    try:
        # extract_info with download=False actively checks if the site allows extraction/conversion
        with YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(data['url'], download=False)
        print(f"  ✅ {name} is supported.")
        return True
    except Exception as e:
        error_msg = str(e)
        if '403' in error_msg or 'Forbidden' in error_msg or 'HTTP Error 403' in error_msg:
            print(f"  🚨 {name} returned a 403 Forbidden error. Removing from supported list.")
        else:
            print(f"  ❌ {name} failed or is currently blocked. Removing from supported list.")
        return False

def generate_html(supported_platforms):
    list_items_html = ""
    for name, desc in supported_platforms.items():
        list_items_html += f"                    <li><strong>{name}</strong> &ndash; {desc}</li>\n"

    # Grab the current UTC time to stamp the file
    current_time = datetime.now().strftime("%B %d, %Y at %H:%M UTC")
    platform_count = len(supported_platforms)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supported Platforms | MP3aud.io</title>
    <meta name="description" content="A list of the {platform_count} platforms currently supported by MP3aud.io for audio extraction.">
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="apple-touch-icon" href="favicon.png">
    <meta name="theme-color" content="#FF5500">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main>
        <div class="container" style="max-width: 600px;"> 
            <div class="utility-bar">
                <div class="social-icons">
                    <a href="https://www.instagram.com/mp3aud.io?igsh=ZXljNzMxaGtqdWwz&utm_source=qr" target="_blank" aria-label="Follow us on Instagram">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    </a>
                </div>
                
                <div style="display: flex; gap: 15px; align-items: center;">
                    <a href="index.html" style="font-size: 0.9rem; font-weight: 600; color: #64748b; text-decoration: none; display: flex; align-items: center; gap: 4px; transition: color 0.2s ease;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </a>
                </div>
            </div>

            <header class="logo-container">
                <a href="index.html">
                    <img src="logo.png" alt="MP3aud.io - Media Tools" class="main-logo" style="max-width: 240px; margin-bottom: 10px;">
                </a>
                <h1 class="main-headline">Top Supported Platforms</h1>
                <p class="h1-subtext">Our extraction technology supports over 1,000 websites. Below is an alphabetical list of the most popular platforms you can process today.</p>
            </header>
                      
            <section aria-label="Supported Websites" style="text-align: left; margin-top: 10px;">
                <ol style="padding-left: 20px; color: #334155; line-height: 1.8; font-size: 0.90rem; margin-bottom: 30px;">
{list_items_html}                </ol>

                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; font-size: 0.85rem; color: #1e40af; line-height: 1.5;">
                    <p style="margin: 0; display: flex; align-items: flex-start; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        <strong>Note on Restrictions:</strong> Platforms that utilize heavy DRM (such as Spotify, Apple Music, and Netflix) are strictly protected and cannot be processed.
                    </p>
                </div>
            </section>

            <footer style="margin-top: 30px; text-align: center; font-size: 0.85rem; color: #64748b;">
                <p>&copy; 2026 MP3aud.io. All Rights Reserved.</p>
                <nav class="footer-links" aria-label="Footer navigation">
                    <a href="index.html">Home</a> | 
                    <a href="mailto:jameskocaba@gmail.com">Contact</a>
                </nav>
                <p style="margin-top: 15px; font-size: 0.75rem;"><em>Status List Last Auto-Updated: {current_time}</em></p>
            </footer>
        </div>
    </main>
</body>
</html>"""
    
    with open("supported-sites.html", "w", encoding="utf-8") as file:
        file.write(html_content)
    print(f"\n✅ Successfully updated supported-sites.html. Filtered down to {platform_count} active platforms.")

if __name__ == "__main__":
    print("Starting platform health check...\n")
    active_platforms = {}
    
    for platform_name, data in PLATFORMS_TO_TEST.items():
        if data.get("skip_test", False):
            print(f"Skipping test for {platform_name} (Forced inclusion). Adding to list.")
            active_platforms[platform_name] = data['desc']
        else:
            is_working = check_platform(platform_name, data)
            if is_working:
                active_platforms[platform_name] = data['desc']
            
            # Add a 1-second delay between requests to avoid rate limiting
            time.sleep(1)
            
    # Restructure active_platforms: Ensure SoundCloud is first, then sort the rest alphabetically
    ordered_platforms = {}
    
    # 1. Pop SoundCloud and place it at the very top (if it successfully validated or was forced)
    if "SoundCloud" in active_platforms:
        ordered_platforms["SoundCloud"] = active_platforms.pop("SoundCloud")
        
    # 2. Sort the remaining platforms alphabetically and append them
    for key in sorted(active_platforms.keys()):
        ordered_platforms[key] = active_platforms[key]
        
    generate_html(ordered_platforms)