/**
 * Tool Definitions for WP Navigator Pro MCP Server
 *
 * Complete set of tools covering all guardrail permissions:
 * - Content: Posts, Pages, Media, Comments, Categories, Tags, Taxonomies (v1.3)
 * - Users: Create, Read, Update, Delete, Manage Roles (v1.3)
 * - Plugins: Install, Activate, Deactivate, Delete, Update
 * - Themes: Install, Activate, Delete, Update, Customize
 *
 * v1.3: Added 17 new tools (Categories, Tags, Taxonomies, Users)
 */

export const tools = [
  // ============================================================================
  // CORE / INTROSPECTION
  // ============================================================================
  {
    name: 'wpnav_help',
    description:
      'Get connection status, environment hints, and quickstart actions for using WP Navigator MCP with CLI clients.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'wpnav.help',
    description:
      'Alias for wpnav_help. Returns connection status, env hints and next steps.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'wpnav_introspect',
    description:
      'Get WP Navigator Pro API capabilities, policy configuration, and environment hints. Call this first to understand what the API can do.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  // ============================================================================
  // PAGES (Content Management)
  // ============================================================================
  {
    name: 'wpnav_list_pages',
    description:
      'List WordPress pages with optional filtering. Returns page ID, title, status, and last modified date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of pages to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        status: {
          type: 'string' as const,
          description: 'Filter by status: publish, draft, private, or any',
          enum: ['publish', 'draft', 'private', 'any'],
          default: 'publish',
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter pages by title or content',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_page',
    description:
      'Get a single WordPress page by ID. Returns full page content, metadata, and edit history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress page ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_create_page',
    description:
      'Create a new WordPress page. Requires title and optional content. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string' as const,
          description: 'Page title',
        },
        content: {
          type: 'string' as const,
          description: 'Page content (HTML). Optional.',
        },
        status: {
          type: 'string' as const,
          description: 'Page status: publish, draft, private (default: draft)',
          enum: ['publish', 'draft', 'private'],
          default: 'draft',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'wpnav_update_page',
    description:
      'Update a WordPress page. Requires page ID and at least one field to update (title, content, or status). Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress page ID',
        },
        title: {
          type: 'string' as const,
          description: 'New page title',
        },
        content: {
          type: 'string' as const,
          description:
            'New page content (HTML). WordPress will auto-save revisions.',
        },
        status: {
          type: 'string' as const,
          description: 'Page status: publish, draft, private',
          enum: ['publish', 'draft', 'private'],
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_page',
    description:
      'Delete a WordPress page by ID. Changes are logged in audit trail. WARNING: This action cannot be undone (page moves to trash by default).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress page ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion (skip trash). Default: false',
          default: false,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // POSTS (Content Management)
  // ============================================================================
  {
    name: 'wpnav_list_posts',
    description:
      'List WordPress blog posts with optional filtering. Returns post ID, title, status, and last modified date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of posts to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        status: {
          type: 'string' as const,
          description: 'Filter by status: publish, draft, private, or any',
          enum: ['publish', 'draft', 'private', 'any'],
          default: 'publish',
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter posts by title or content',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_post',
    description:
      'Get a single WordPress post by ID. Returns full post content, metadata, categories, and tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress post ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_create_post',
    description:
      'Create a new WordPress blog post. Requires title and optional content. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string' as const,
          description: 'Post title',
        },
        content: {
          type: 'string' as const,
          description: 'Post content (HTML). Optional.',
        },
        status: {
          type: 'string' as const,
          description: 'Post status: publish, draft, private (default: draft)',
          enum: ['publish', 'draft', 'private'],
          default: 'draft',
        },
        excerpt: {
          type: 'string' as const,
          description: 'Post excerpt. Optional.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'wpnav_update_post',
    description:
      'Update a WordPress post. Requires post ID and at least one field to update. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress post ID',
        },
        title: {
          type: 'string' as const,
          description: 'New post title',
        },
        content: {
          type: 'string' as const,
          description: 'New post content (HTML).',
        },
        status: {
          type: 'string' as const,
          description: 'Post status: publish, draft, private',
          enum: ['publish', 'draft', 'private'],
        },
        excerpt: {
          type: 'string' as const,
          description: 'Post excerpt',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_post',
    description:
      'Delete a WordPress post by ID. Changes are logged in audit trail. WARNING: This action cannot be undone (post moves to trash by default).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress post ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion (skip trash). Default: false',
          default: false,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // MEDIA (Content Management)
  // ============================================================================
  {
    name: 'wpnav_list_media',
    description:
      'List WordPress media library items. Returns media ID, title, URL, and mime type.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of media items to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        media_type: {
          type: 'string' as const,
          description: 'Filter by media type: image, video, application, etc.',
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter media by title or filename',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_media',
    description:
      'Get a single media item by ID. Returns full metadata including URL, dimensions, and file info.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress media ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_media',
    description:
      'Delete a media item by ID. WARNING: This permanently deletes the file from the server.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress media ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion. Default: true for media',
          default: true,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // COMMENTS (Content Management)
  // ============================================================================
  {
    name: 'wpnav_list_comments',
    description:
      'List WordPress comments with optional filtering. Returns comment ID, author, content, and status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of comments to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        status: {
          type: 'string' as const,
          description: 'Filter by status: approve, hold, spam, trash, any',
          enum: ['approve', 'hold', 'spam', 'trash', 'any'],
        },
        post: {
          type: 'number' as const,
          description: 'Filter by post ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_comment',
    description:
      'Get a single comment by ID. Returns full comment details including author info and content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress comment ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_update_comment',
    description:
      'Update a comment. Can change status (approve/hold/spam) or content. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress comment ID',
        },
        status: {
          type: 'string' as const,
          description: 'Comment status: approve, hold, spam, trash',
          enum: ['approve', 'hold', 'spam', 'trash'],
        },
        content: {
          type: 'string' as const,
          description: 'Comment content',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_comment',
    description:
      'Delete a comment by ID. WARNING: This action cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress comment ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion (skip trash). Default: false',
          default: false,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // CATEGORIES (Content Management - Taxonomies)
  // ============================================================================
  {
    name: 'wpnav_list_categories',
    description:
      'List all WordPress categories with optional filtering. Returns category ID, name, slug, count, and parent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of categories to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter categories by name',
        },
        parent: {
          type: 'number' as const,
          description: 'Filter by parent category ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_category',
    description:
      'Get a single WordPress category by ID. Returns full category details including description and post count.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress category ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_create_category',
    description:
      'Create a new WordPress category. Requires name. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string' as const,
          description: 'Category name',
        },
        description: {
          type: 'string' as const,
          description: 'Category description (optional)',
        },
        slug: {
          type: 'string' as const,
          description: 'Category slug (optional, auto-generated from name if not provided)',
        },
        parent: {
          type: 'number' as const,
          description: 'Parent category ID (optional, for hierarchical categories)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'wpnav_update_category',
    description:
      'Update a WordPress category. Requires category ID and at least one field to update. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress category ID',
        },
        name: {
          type: 'string' as const,
          description: 'New category name',
        },
        description: {
          type: 'string' as const,
          description: 'New category description',
        },
        slug: {
          type: 'string' as const,
          description: 'New category slug',
        },
        parent: {
          type: 'number' as const,
          description: 'New parent category ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_category',
    description:
      'Delete a WordPress category by ID. Posts in this category will be reassigned to Uncategorized. WARNING: This action cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress category ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion. Default: true',
          default: true,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // TAGS (Content Management - Taxonomies)
  // ============================================================================
  {
    name: 'wpnav_list_tags',
    description:
      'List all WordPress tags with optional filtering. Returns tag ID, name, slug, and count.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of tags to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter tags by name',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_tag',
    description:
      'Get a single WordPress tag by ID. Returns full tag details including description and post count.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress tag ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_create_tag',
    description:
      'Create a new WordPress tag. Requires name. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string' as const,
          description: 'Tag name',
        },
        description: {
          type: 'string' as const,
          description: 'Tag description (optional)',
        },
        slug: {
          type: 'string' as const,
          description: 'Tag slug (optional, auto-generated from name if not provided)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'wpnav_update_tag',
    description:
      'Update a WordPress tag. Requires tag ID and at least one field to update. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress tag ID',
        },
        name: {
          type: 'string' as const,
          description: 'New tag name',
        },
        description: {
          type: 'string' as const,
          description: 'New tag description',
        },
        slug: {
          type: 'string' as const,
          description: 'New tag slug',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_tag',
    description:
      'Delete a WordPress tag by ID. Posts with this tag will have it removed. WARNING: This action cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress tag ID',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion. Default: true',
          default: true,
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // TAXONOMIES (Content Management - Read-Only Discovery)
  // ============================================================================
  {
    name: 'wpnav_list_taxonomies',
    description:
      'List all registered WordPress taxonomies (categories, tags, custom). Returns taxonomy name, labels, and capabilities. Always available for site structure discovery.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string' as const,
          description: 'Filter by post type (e.g., "post", "page")',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_taxonomy',
    description:
      'Get details about a specific taxonomy by name. Returns full taxonomy configuration including hierarchical status, REST base, and labels. Always available for site structure discovery.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taxonomy: {
          type: 'string' as const,
          description: 'Taxonomy name (e.g., "category", "post_tag", or custom taxonomy)',
        },
      },
      required: ['taxonomy'],
    },
  },

  // ============================================================================
  // USERS (User Management)
  // ============================================================================
  {
    name: 'wpnav_list_users',
    description:
      'List WordPress users with optional filtering. Returns user ID, username, email, roles, and display name.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        per_page: {
          type: 'number' as const,
          description: 'Number of users to return (default: 10, max: 100)',
          default: 10,
        },
        page: {
          type: 'number' as const,
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        roles: {
          type: 'string' as const,
          description: 'Filter by role: administrator, editor, author, contributor, subscriber',
        },
        search: {
          type: 'string' as const,
          description: 'Search term to filter users by username, email, or display name',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_user',
    description:
      'Get a single WordPress user by ID. Returns full user profile including roles, capabilities, and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress user ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_create_user',
    description:
      'Create a new WordPress user. Requires username and email. Changes are logged in audit trail. HIGH RISK: Can create admin users.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        username: {
          type: 'string' as const,
          description: 'Username (required, must be unique)',
        },
        email: {
          type: 'string' as const,
          description: 'Email address (required, must be unique)',
        },
        password: {
          type: 'string' as const,
          description: 'User password (optional, auto-generated if not provided)',
        },
        first_name: {
          type: 'string' as const,
          description: 'First name (optional)',
        },
        last_name: {
          type: 'string' as const,
          description: 'Last name (optional)',
        },
        roles: {
          type: 'array' as const,
          description: 'User roles (default: ["subscriber"])',
          items: {
            type: 'string' as const,
            enum: ['administrator', 'editor', 'author', 'contributor', 'subscriber'],
          },
        },
      },
      required: ['username', 'email'],
    },
  },
  {
    name: 'wpnav_update_user',
    description:
      'Update a WordPress user. Requires user ID and at least one field to update. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress user ID',
        },
        email: {
          type: 'string' as const,
          description: 'New email address',
        },
        first_name: {
          type: 'string' as const,
          description: 'New first name',
        },
        last_name: {
          type: 'string' as const,
          description: 'New last name',
        },
        display_name: {
          type: 'string' as const,
          description: 'New display name',
        },
        password: {
          type: 'string' as const,
          description: 'New password',
        },
        roles: {
          type: 'array' as const,
          description: 'New user roles. HIGH RISK: Can escalate to administrator.',
          items: {
            type: 'string' as const,
            enum: ['administrator', 'editor', 'author', 'contributor', 'subscriber'],
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'wpnav_delete_user',
    description:
      'Delete a WordPress user by ID. HIGH RISK: Permanent data loss. User content will be reassigned to specified user. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'number' as const,
          description: 'WordPress user ID to delete',
        },
        reassign: {
          type: 'number' as const,
          description: 'User ID to reassign deleted user\'s content to (required)',
        },
        force: {
          type: 'boolean' as const,
          description: 'Force permanent deletion. Default: true',
          default: true,
        },
      },
      required: ['id', 'reassign'],
    },
  },

  // ============================================================================
  // PLUGINS (Plugin Management)
  // ============================================================================
  {
    name: 'wpnav_list_plugins',
    description:
      'List all installed WordPress plugins. Returns plugin slug, name, version, and status (active/inactive).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string' as const,
          description: 'Optional filter by status (e.g., "active" or "inactive"). If omitted or set to "all", returns all plugins.',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_plugin',
    description:
      'Get details about a specific plugin by slug. Returns full metadata including description, author, and version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plugin: {
          type: 'string' as const,
          description: 'Plugin slug (e.g., "akismet/akismet.php")',
        },
      },
      required: ['plugin'],
    },
  },
  {
    name: 'wpnav_install_plugin',
    description:
      'Install a WordPress plugin from WordPress.org by slug. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string' as const,
          description: 'Plugin slug from WordPress.org (e.g., "akismet")',
        },
        activate: {
          type: 'boolean' as const,
          description: 'Activate plugin after installation (default: false)',
          default: false,
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'wpnav_activate_plugin',
    description:
      'Activate a WordPress plugin by slug. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plugin: {
          type: 'string' as const,
          description: 'Plugin slug (e.g., "akismet/akismet.php")',
        },
      },
      required: ['plugin'],
    },
  },
  {
    name: 'wpnav_deactivate_plugin',
    description:
      'Deactivate a WordPress plugin by slug. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plugin: {
          type: 'string' as const,
          description: 'Plugin slug (e.g., "akismet/akismet.php")',
        },
      },
      required: ['plugin'],
    },
  },
  {
    name: 'wpnav_update_plugin',
    description:
      'Update a WordPress plugin to the latest version. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plugin: {
          type: 'string' as const,
          description: 'Plugin slug (e.g., "akismet/akismet.php")',
        },
      },
      required: ['plugin'],
    },
  },
  {
    name: 'wpnav_delete_plugin',
    description:
      'Delete a WordPress plugin by slug. Plugin must be deactivated first. WARNING: This permanently deletes the plugin files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plugin: {
          type: 'string' as const,
          description: 'Plugin slug (e.g., "akismet/akismet.php")',
        },
      },
      required: ['plugin'],
    },
  },

  // ============================================================================
  // THEMES (Theme Management)
  // ============================================================================
  {
    name: 'wpnav_list_themes',
    description:
      'List all installed WordPress themes. Returns theme slug, name, version, and status (active/inactive).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string' as const,
          description: 'Optional filter by status (e.g., "active" or "inactive"). If omitted or set to "all", returns all themes.',
        },
      },
      required: [],
    },
  },
  {
    name: 'wpnav_get_theme',
    description:
      'Get details about a specific theme by slug. Returns full metadata including description, author, and version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stylesheet: {
          type: 'string' as const,
          description: 'Theme stylesheet name (slug)',
        },
      },
      required: ['stylesheet'],
    },
  },
  {
    name: 'wpnav_install_theme',
    description:
      'Install a WordPress theme from WordPress.org by slug. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string' as const,
          description: 'Theme slug from WordPress.org (e.g., "twentytwentyfour")',
        },
        activate: {
          type: 'boolean' as const,
          description: 'Activate theme after installation (default: false)',
          default: false,
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'wpnav_activate_theme',
    description:
      'Activate a WordPress theme by stylesheet name. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stylesheet: {
          type: 'string' as const,
          description: 'Theme stylesheet name (slug)',
        },
      },
      required: ['stylesheet'],
    },
  },
  {
    name: 'wpnav_update_theme',
    description:
      'Update a WordPress theme to the latest version. Changes are logged in audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stylesheet: {
          type: 'string' as const,
          description: 'Theme stylesheet name (slug)',
        },
      },
      required: ['stylesheet'],
    },
  },
  {
    name: 'wpnav_delete_theme',
    description:
      'Delete a WordPress theme by stylesheet name. Theme must not be active. WARNING: This permanently deletes the theme files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stylesheet: {
          type: 'string' as const,
          description: 'Theme stylesheet name (slug)',
        },
      },
      required: ['stylesheet'],
    },
  },
];
