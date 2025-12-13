/**
 * Testing Tools Registration
 *
 * Handles: Test metrics tracking and test data generation
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0 - Phase 2 Test Automation
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * In-memory test metrics storage
 */
interface TestMetrics {
  startTime?: number;
  endTime?: number;
  phases: Record<string, { completed: boolean; timestamp: number }>;
  tools: Record<string, { success: number; failure: number; errors: string[] }>;
}

const testMetrics: TestMetrics = {
  phases: {},
  tools: {},
};

/**
 * Register testing tools (metrics, seed data)
 */
export function registerTestingTools() {
  // ============================================================================
  // TEST METRICS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_metrics',
      description: 'Track test execution metrics and generate reports. Use this to monitor test progress, measure automation success rate, and capture detailed execution statistics.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['start', 'phase_complete', 'tool_result', 'finish', 'report', 'reset'],
            description: 'Action to perform: start (begin test), phase_complete (mark phase done), tool_result (record tool call), finish (end test), report (get metrics), reset (clear metrics)',
          },
          phase: { type: 'string', description: 'Phase name (required for phase_complete)' },
          tool: { type: 'string', description: 'Tool name (required for tool_result)' },
          success: { type: 'boolean', description: 'Whether tool call succeeded (required for tool_result)' },
          duration_ms: { type: 'integer', description: 'Tool execution duration in milliseconds (optional for tool_result)' },
          error: { type: 'string', description: 'Error message if tool call failed (optional for tool_result)' },
        },
        required: ['action'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['action']);

      try {
        switch (args.action) {
          case 'start':
            // Reset and start new test
            testMetrics.startTime = Date.now();
            testMetrics.endTime = undefined;
            testMetrics.phases = {};
            testMetrics.tools = {};

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify({
                  action: 'start',
                  timestamp: testMetrics.startTime,
                  message: 'Test metrics tracking started',
                }, null, 2)),
              }],
            };

          case 'phase_complete':
            if (!args.phase) {
              throw new Error('phase parameter required for phase_complete action');
            }

            testMetrics.phases[args.phase] = {
              completed: true,
              timestamp: Date.now(),
            };

            const phasesCompleted = Object.keys(testMetrics.phases).length;

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify({
                  action: 'phase_complete',
                  phase: args.phase,
                  timestamp: Date.now(),
                  phases_completed: phasesCompleted,
                  message: `Phase "${args.phase}" marked as complete`,
                }, null, 2)),
              }],
            };

          case 'tool_result':
            if (!args.tool) {
              throw new Error('tool parameter required for tool_result action');
            }
            if (args.success === undefined) {
              throw new Error('success parameter required for tool_result action');
            }

            // Initialize tool metrics if not exists
            if (!testMetrics.tools[args.tool]) {
              testMetrics.tools[args.tool] = {
                success: 0,
                failure: 0,
                errors: [],
              };
            }

            // Update metrics
            if (args.success) {
              testMetrics.tools[args.tool].success++;
            } else {
              testMetrics.tools[args.tool].failure++;
              if (args.error) {
                testMetrics.tools[args.tool].errors.push(args.error);
              }
            }

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify({
                  action: 'tool_result',
                  tool: args.tool,
                  success: args.success,
                  duration_ms: args.duration_ms,
                  message: `Tool "${args.tool}" result recorded`,
                }, null, 2)),
              }],
            };

          case 'finish':
            testMetrics.endTime = Date.now();

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify({
                  action: 'finish',
                  timestamp: testMetrics.endTime,
                  message: 'Test metrics tracking finished',
                }, null, 2)),
              }],
            };

          case 'report':
            // Calculate metrics
            const duration = testMetrics.endTime
              ? testMetrics.endTime - (testMetrics.startTime || 0)
              : Date.now() - (testMetrics.startTime || 0);

            const durationMinutes = (duration / 1000 / 60).toFixed(2);

            let totalToolCalls = 0;
            let successfulToolCalls = 0;
            const toolErrors: Array<{ tool: string; error: string }> = [];

            Object.entries(testMetrics.tools).forEach(([tool, metrics]) => {
              totalToolCalls += metrics.success + metrics.failure;
              successfulToolCalls += metrics.success;

              metrics.errors.forEach(error => {
                toolErrors.push({ tool, error });
              });
            });

            const successRate = totalToolCalls > 0
              ? ((successfulToolCalls / totalToolCalls) * 100).toFixed(2)
              : '0.00';

            const automationPercentage = totalToolCalls > 0
              ? ((successfulToolCalls / totalToolCalls) * 100).toFixed(1)
              : '0.0';

            const report = {
              test_started: testMetrics.startTime ? new Date(testMetrics.startTime).toISOString() : null,
              test_ended: testMetrics.endTime ? new Date(testMetrics.endTime).toISOString() : 'In progress',
              test_duration_ms: duration,
              test_duration_minutes: parseFloat(durationMinutes),
              phases_completed: Object.keys(testMetrics.phases).length,
              phases: Object.keys(testMetrics.phases),
              tool_success_rate: `${successRate}%`,
              total_tools_called: totalToolCalls,
              successful_tool_calls: successfulToolCalls,
              failed_tool_calls: totalToolCalls - successfulToolCalls,
              tools_used: Object.keys(testMetrics.tools).length,
              tool_breakdown: testMetrics.tools,
              errors: toolErrors.length > 0 ? toolErrors : 'No errors',
              automation_percentage: `${automationPercentage}%`,
            };

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify(report, null, 2)),
              }],
            };

          case 'reset':
            // Clear all metrics
            testMetrics.startTime = undefined;
            testMetrics.endTime = undefined;
            testMetrics.phases = {};
            testMetrics.tools = {};

            return {
              content: [{
                type: 'text',
                text: context.clampText(JSON.stringify({
                  action: 'reset',
                  message: 'Test metrics cleared',
                }, null, 2)),
              }],
            };

          default:
            throw new Error(`Unknown action: ${args.action}`);
        }
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              error: 'Test metrics operation failed',
              message: error.message || 'Unknown error',
              action: args.action,
            }, null, 2)),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT, // Using CONTENT category since there's no TESTING category
  });

  // ============================================================================
  // SEED TEST DATA
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_seed_test_data',
      description: 'Generate bulk test data (comments, posts, users) via REST API. Works with any WordPress instance (local, Hetzner, production).',
      inputSchema: {
        type: 'object',
        properties: {
          data_type: {
            type: 'string',
            enum: ['comments', 'posts', 'users', 'all'],
            description: 'Type of data to generate: comments (bulk comments on posts), posts (draft posts), users (subscriber accounts), all (mixed content)',
          },
          amount: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            description: 'Number of items to create (1-50, default: 10)',
            default: 10,
          },
          post_id: {
            type: 'integer',
            description: 'Post ID for comments (required if data_type is "comments")',
          },
        },
        required: ['data_type'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['data_type']);

      const amount = args.amount || 10;

      // Validate amount
      if (amount < 1 || amount > 50) {
        throw new Error('amount must be between 1 and 50');
      }

      try {
        const results: any[] = [];

        switch (args.data_type) {
          case 'comments':
            // Validate post_id for comments
            if (!args.post_id) {
              throw new Error('post_id parameter required for comments data_type');
            }

            // Generate bulk comments using REST API
            for (let i = 0; i < amount; i++) {
              const content = `Test comment #${i + 1} - Generated at ${new Date().toISOString()}`;
              const authorName = `TestUser${i + 1}`;
              const authorEmail = `testuser${i + 1}@example.com`;

              try {
                const result = await context.wpRequest('/wp/v2/comments', {
                  method: 'POST',
                  body: JSON.stringify({
                    post: args.post_id,
                    content: content,
                    author_name: authorName,
                    author_email: authorEmail,
                    status: 'approve',
                  }),
                });

                results.push({
                  type: 'comment',
                  id: result.id,
                  post_id: args.post_id,
                  author_name: authorName,
                });
              } catch (error: any) {
                results.push({
                  type: 'comment',
                  error: error.message,
                });
              }
            }
            break;

          case 'posts':
            // Generate bulk posts using REST API
            for (let i = 0; i < amount; i++) {
              const title = `Test Post #${i + 1} - ${new Date().toISOString()}`;
              const content = `This is test post #${i + 1} generated by wpnav_seed_test_data tool. Created at ${new Date().toISOString()}`;

              try {
                const result = await context.wpRequest('/wp/v2/posts', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: title,
                    content: content,
                    status: 'draft',
                  }),
                });

                results.push({
                  type: 'post',
                  id: result.id,
                  title: result.title?.rendered || title,
                  status: result.status,
                });
              } catch (error: any) {
                results.push({
                  type: 'post',
                  error: error.message,
                });
              }
            }
            break;

          case 'users':
            // Generate bulk users using REST API
            for (let i = 0; i < amount; i++) {
              const timestamp = Date.now();
              const username = `testuser_${timestamp}_${i}`;
              const email = `${username}@example.com`;
              const displayName = `Test User ${i + 1}`;

              try {
                const result = await context.wpRequest('/wp/v2/users', {
                  method: 'POST',
                  body: JSON.stringify({
                    username: username,
                    email: email,
                    password: 'TestPass123!',
                    name: displayName,
                    roles: ['subscriber'],
                  }),
                });

                results.push({
                  type: 'user',
                  id: result.id,
                  username: result.username,
                  email: email,
                  role: 'subscriber',
                });
              } catch (error: any) {
                results.push({
                  type: 'user',
                  error: error.message,
                });
              }
            }
            break;

          case 'all':
            // Generate mix of content
            const mixAmount = Math.floor(amount / 3);

            // Create a post first
            let postId: number;
            try {
              const postResult = await context.wpRequest('/wp/v2/posts', {
                method: 'POST',
                body: JSON.stringify({
                  title: `Mixed Test Post - ${new Date().toISOString()}`,
                  content: 'Test content for mixed data generation',
                  status: 'draft',
                }),
              });

              postId = postResult.id;
              results.push({
                type: 'post',
                id: postId,
                title: postResult.title?.rendered || 'Mixed Test Post',
              });
            } catch (error: any) {
              return {
                content: [{
                  type: 'text',
                  text: context.clampText(JSON.stringify({
                    error: 'Failed to create initial post for mixed data',
                    message: error.message,
                  }, null, 2)),
                }],
                isError: true,
              };
            }

            // Create comments on the post
            for (let i = 0; i < mixAmount; i++) {
              try {
                const commentResult = await context.wpRequest('/wp/v2/comments', {
                  method: 'POST',
                  body: JSON.stringify({
                    post: postId,
                    content: `Mixed test comment #${i + 1}`,
                    author_name: `MixedUser${i + 1}`,
                    author_email: `mixeduser${i + 1}@example.com`,
                    status: 'approve',
                  }),
                });

                results.push({
                  type: 'comment',
                  id: commentResult.id,
                  post_id: postId,
                });
              } catch (error: any) {
                results.push({ type: 'comment', error: error.message });
              }
            }

            // Create users
            for (let i = 0; i < mixAmount; i++) {
              const timestamp = Date.now();
              const username = `mixed_user_${timestamp}_${i}`;

              try {
                const userResult = await context.wpRequest('/wp/v2/users', {
                  method: 'POST',
                  body: JSON.stringify({
                    username: username,
                    email: `${username}@example.com`,
                    password: 'TestPass123!',
                    name: `Mixed User ${i + 1}`,
                    roles: ['subscriber'],
                  }),
                });

                results.push({
                  type: 'user',
                  id: userResult.id,
                  username: userResult.username,
                });
              } catch (error: any) {
                results.push({ type: 'user', error: error.message });
              }
            }
            break;

          default:
            throw new Error(`Unknown data_type: ${args.data_type}`);
        }

        const successCount = results.filter(r => !r.error).length;
        const failureCount = results.filter(r => r.error).length;

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              data_type: args.data_type,
              amount_requested: amount,
              items_created: successCount,
              failures: failureCount,
              results,
              message: `Seed data generation complete: ${successCount} items created, ${failureCount} failures`,
            }, null, 2)),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              error: 'Seed data generation failed',
              message: error.message || 'Unknown error',
              data_type: args.data_type,
            }, null, 2)),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });
}
