# Lambda@Edge Update Required

## Current Lambda@Edge Code
```javascript
return {
  status: "302",
  statusDescription: "Found",
  headers: {
    location: [
      {
        key: "Location",
        value: "/public/login",
      },
    ],
  },
};
```

## Updated Lambda@Edge Code
```javascript
return {
  status: "302",
  statusDescription: "Found",
  headers: {
    location: [
      {
        key: "Location",
        value: `/auth/?return_url=${encodeURIComponent(request.uri)}`,
      },
    ],
  },
};
```

## What Changed
- **Old**: Redirects to `/public/login` (loses original URL)
- **New**: Redirects to `/auth/?return_url=/original/path` (preserves original URL)

## File to Update
Update this in your cognito project:
`/home/marcel/development/quicken/aws-static-hosting/cognito/src/index.ts`

Find the redirect logic and change the location value to include the return_url parameter.

## Result
- User visits `/app1/dashboard`
- Lambda@Edge redirects to `/auth/?return_url=%2Fapp1%2Fdashboard`
- After login, user returns to `/app1/dashboard`
