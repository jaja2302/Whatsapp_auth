<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class Apicontroller extends Controller
{

    // api bot wa jobtask
    public function addTask(Request $request)
    {
        $task = DB::table('jobs')->insert([
            'queue' => 'default',
            'payload' => json_encode([
                'type' => $request->input('type'),
                'data' => $request->input('data'),
            ]),
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
            'status' => 'pending',
            'processed_by' => null,
        ]);

        return response()->json(['message' => 'Task added to queue']);
    }

    public function getNextTask(Request $request)
    {
        $botId = $request->input('bot_id');
        $maxRetries = 3;
        $stuckTaskThreshold = now()->subMinutes(5);

        // First, update the requesting bot's status
        DB::table('bots')->updateOrInsert(
            ['id' => $botId],
            [
                'last_heartbeat' => now(),
                'status' => 'active'
            ]
        );

        DB::beginTransaction();

        try {
            $task = DB::table('jobs')
                ->where(function ($query) use ($maxRetries, $stuckTaskThreshold) {
                    $query->where('status', 'pending')
                        ->orWhere(function ($query) use ($maxRetries, $stuckTaskThreshold) {
                            $query->where('status', 'processing')
                                ->where('updated_at', '<', $stuckTaskThreshold)
                                ->where('retries', '<', $maxRetries);
                        })
                        ->orWhere(function ($query) use ($maxRetries) {
                            $query->where('status', 'failed')
                                ->where('retries', '<', $maxRetries);
                        });
                })
                ->whereNull('processed_by')
                ->orWhere('processed_by', function ($query) {
                    $query->select('id')
                        ->from('bots')
                        ->where('status', 'inactive');
                })
                ->lockForUpdate()
                ->first();

            if ($task) {
                DB::table('jobs')
                    ->where('id', $task->id)
                    ->update([
                        'status' => 'processing',
                        'processed_by' => $botId,
                        'retries' => DB::raw('retries + 1'),
                        'updated_at' => now()
                    ]);

                DB::commit();

                $decodedPayload = json_decode($task->payload, true);

                return response()->json([
                    'task_id' => $task->id,
                    'payload' => $decodedPayload,
                    'retry_count' => $task->retries
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'No pending tasks']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Error fetching task: ' . $e->getMessage()], 500);
        }
    }
    public function completeTask(Request $request)
    {
        $taskId = $request->input('task_id');
        $success = $request->input('success');
        $markAsFailed = $request->input('mark_as_failed', false);

        if ($success) {
            // If the task was successful, delete it from the database
            DB::table('jobs')->where('id', $taskId)->delete();
            return response()->json(['message' => 'Task completed and removed from the database']);
        } else {
            // If the task failed, update its status
            $status = $markAsFailed ? 'failed' : 'pending';
            DB::table('jobs')
                ->where('id', $taskId)
                ->update([
                    'status' => $status,
                    'updated_at' => now()
                ]);
            return response()->json(['message' => 'Task status updated']);
        }
    }
    public function getQueueState(Request $request)
    {
        $botId = $request->input('bot_id');

        $pendingTasks = DB::table('jobs')
            ->where('status', 'pending')
            ->count();

        $processingTasks = DB::table('jobs')
            ->where('status', 'processing')
            ->where('processed_by', $botId)
            ->count();

        $completedTasks = DB::table('jobs')
            ->where('status', 'completed')
            ->where('processed_by', $botId)
            ->count();

        $failedTasks = DB::table('jobs')
            ->where('status', 'failed')
            ->where('processed_by', $botId)
            ->count();

        return response()->json([
            'pending_tasks' => $pendingTasks,
            'processing_tasks' => $processingTasks,
            'completed_tasks' => $completedTasks,
            'failed_tasks' => $failedTasks,
        ]);
    }

    public function getNextStuckTask(Request $request)
    {
        $maxRetries = 3;
        $stuckTaskThreshold = now()->subMinutes(5);

        $task = DB::table('jobs')
            ->where('status', 'processing')
            ->where('updated_at', '<', $stuckTaskThreshold)
            ->where('retries', '<', $maxRetries)
            ->first();

        if ($task) {
            DB::table('jobs')
                ->where('id', $task->id)
                ->update([
                    'retries' => DB::raw('retries + 1'),
                    'updated_at' => now()
                ]);

            $decodedPayload = json_decode($task->payload, true);

            return response()->json([
                'task_id' => $task->id,
                'payload' => $decodedPayload,
                'retry_count' => $task->retries
            ]);
        }

        return response()->json(['message' => 'No stuck tasks']);
    }

    public function botHeartbeat(Request $request)
    {
        $botId = $request->input('bot_id');

        DB::table('bots')->updateOrInsert(
            ['id' => $botId],
            [
                'last_heartbeat' => now(),
                'status' => 'active'
            ]
        );

        return response()->json(['message' => 'Heartbeat recorded']);
    }
    public function updateBotStatuses()
    {
        $inactiveThreshold = now()->subMinutes(2); // Consider a bot inactive if no heartbeat for 2 minutes

        DB::table('bots')
            ->where('last_heartbeat', '<', $inactiveThreshold)
            ->update(['status' => 'inactive']);

        return response()->json(['message' => 'Bot statuses updated']);
    }
    // Reset processing tasks that are stuck
    public function resetStuckTasks()
    {
        $stuckThreshold = now()->subMinutes(5); // Define how old a task must be to consider it "stuck"

        DB::table('jobs')
            ->where('status', 'processing')
            ->where('updated_at', '<', $stuckThreshold)
            ->update([
                'status' => 'pending',
                'processed_by' => null,
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Stuck tasks reset to pending']);
    }
}
