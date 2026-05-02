#!/bin/bash

echo "🚀 Mock API Responses for Screenshots"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to show mock API request/response
show_mock_request() {
    local method=$1
    local url=$2
    local request_data=$3
    local response_data=$4
    local description=$5

    echo -e "\n${BLUE}=== $description ===${NC}"
    echo -e "${YELLOW}$method $url${NC}"

    if [ -n "$request_data" ]; then
        echo -e "${GREEN}Request Body:${NC}"
        echo "$request_data" | jq '.' 2>/dev/null || echo "$request_data"
        echo ""
    fi

    echo -e "${GREEN}Response (200 OK):${NC}"
    echo "$response_data" | jq '.' 2>/dev/null || echo "$response_data"

    echo -e "${BLUE}$(printf '%.0s=' {1..50})${NC}"
}

# Mock responses
PLACEMENT_RESPONSE='{
  "success": true,
  "data": {
    "id": "notif_abc123",
    "userId": "user-123",
    "type": "placement",
    "title": "Job Offer from Tech Corp",
    "message": "Congratulations! You have received a job offer from Tech Corp for the Software Engineer position with a salary of 12 LPA.",
    "priority": "urgent",
    "isRead": false,
    "createdAt": "2026-05-02T12:30:00Z",
    "updatedAt": "2026-05-02T12:30:00Z",
    "metadata": {
      "companyName": "Tech Corp",
      "salary": "12 LPA",
      "position": "Software Engineer"
    }
  },
  "timestamp": "2026-05-02T12:30:00Z"
}'

INTERVIEW_RESPONSE='{
  "success": true,
  "data": {
    "id": "notif_def456",
    "userId": "user-456",
    "type": "interview",
    "title": "Interview Scheduled with Google",
    "message": "Your technical interview with Google is scheduled for tomorrow at 2 PM. Please be prepared with your resume and portfolio.",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-05-02T12:31:00Z",
    "updatedAt": "2026-05-02T12:31:00Z",
    "metadata": {
      "companyName": "Google",
      "date": "2026-05-03",
      "time": "2:00 PM",
      "round": "Technical Round 1"
    }
  },
  "timestamp": "2026-05-02T12:31:00Z"
}'

LIST_RESPONSE='{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_abc123",
        "userId": "user-123",
        "type": "placement",
        "title": "Job Offer from Tech Corp",
        "priority": "urgent",
        "isRead": false,
        "createdAt": "2026-05-02T12:30:00Z"
      },
      {
        "id": "notif_def456",
        "userId": "user-123",
        "type": "interview",
        "title": "Interview Scheduled with Google",
        "priority": "high",
        "isRead": false,
        "createdAt": "2026-05-02T12:31:00Z"
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  },
  "timestamp": "2026-05-02T12:32:00Z"
}'

PRIORITY_INBOX_RESPONSE='{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_abc123",
        "userId": "user-123",
        "type": "placement",
        "title": "Job Offer from Tech Corp",
        "priority": "urgent",
        "isRead": false,
        "createdAt": "2026-05-02T12:30:00Z",
        "priorityScore": 7.2
      },
      {
        "id": "notif_def456",
        "userId": "user-123",
        "type": "interview",
        "title": "Interview Scheduled with Google",
        "priority": "high",
        "isRead": false,
        "createdAt": "2026-05-02T12:31:00Z",
        "priorityScore": 6.8
      }
    ],
    "totalAvailable": 5,
    "returnedCount": 2
  },
  "timestamp": "2026-05-02T12:32:00Z"
}'

TEMPLATES_RESPONSE='{
  "success": true,
  "data": [
    {
      "id": "interview-scheduled",
      "name": "Interview Scheduled",
      "description": "Notification for scheduled interviews",
      "variables": ["companyName", "date", "time"]
    },
    {
      "id": "placement-offer",
      "name": "Placement Offer",
      "description": "Job offer congratulations",
      "variables": ["companyName", "position", "salary"]
    },
    {
      "id": "event-announcement",
      "name": "Event Announcement",
      "description": "Campus event notifications",
      "variables": ["eventName", "date", "venue"]
    }
  ],
  "timestamp": "2026-05-02T12:33:00Z"
}'

TEMPLATE_NOTIFICATION_RESPONSE='{
  "success": true,
  "data": {
    "id": "notif_ghi789",
    "userId": "user-999",
    "type": "interview",
    "title": "Interview Scheduled with Amazon",
    "message": "Your interview with Amazon is scheduled for 2026-05-15 at 10:00 AM. Please arrive 15 minutes early.",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-05-02T12:34:00Z",
    "updatedAt": "2026-05-02T12:34:00Z",
    "metadata": {
      "companyName": "Amazon",
      "date": "2026-05-15",
      "time": "10:00 AM"
    }
  },
  "timestamp": "2026-05-02T12:34:00Z"
}'

# Show mock API interactions
show_mock_request "POST" "/api/v1/notifications" "$NOTIFICATION_1" "$PLACEMENT_RESPONSE" "Create Placement Notification"

show_mock_request "POST" "/api/v1/notifications" "$NOTIFICATION_2" "$INTERVIEW_RESPONSE" "Create Interview Notification"

show_mock_request "GET" "/api/v1/notifications/user-123?page=1&limit=10" "" "$LIST_RESPONSE" "Get User Notifications"

show_mock_request "GET" "/api/v1/notifications/user-123/priority-inbox?limit=5" "" "$PRIORITY_INBOX_RESPONSE" "Get Priority Inbox"

show_mock_request "GET" "/api/v1/templates" "" "$TEMPLATES_RESPONSE" "List Available Templates"

show_mock_request "POST" "/api/v1/notifications/from-template" "$TEMPLATE_NOTIFICATION" "$TEMPLATE_NOTIFICATION_RESPONSE" "Create Notification from Template"

echo -e "\n${GREEN}✅ Mock API Responses Complete!${NC}"
echo "📸 Take screenshots of the formatted request/response pairs above"
echo "💡 These show what successful API interactions look like"