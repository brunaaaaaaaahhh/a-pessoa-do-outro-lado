// Vercel Web Analytics using @vercel/analytics package
import { inject } from '@vercel/analytics';

// Custom beforeSend hook to handle hash-based routing
// The site routes with #: report /#cap/3 as /cap/3 so each page shows up on its own
// The admin preview shows the site in a frame: do not count those views
const beforeSendHandler = (event) => {
  // Don't track if site is in a frame (admin preview)
  if (window.top !== window) {
    return null;
  }
  
  // Transform hash-based URLs to clean paths
  return {
    ...event,
    url: event.url.replace('/#', '/')
  };
};

// Inject Vercel Analytics with custom configuration
inject({
  beforeSend: beforeSendHandler,
  debug: false
});
