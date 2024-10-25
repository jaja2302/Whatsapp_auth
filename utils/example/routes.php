<?php

use App\Http\Controllers\Apicontroller;
use App\Http\Middleware\BlockIpAfterFailedAttempts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


Route::get('/next-task', [Apicontroller::class, 'getNextTask']);
Route::post('/complete-task', [Apicontroller::class, 'completeTask']);
Route::get('/queue-state', [Apicontroller::class, 'getQueueState']);
Route::post('/add-task', [Apicontroller::class, 'addTask']);
Route::post('/bot-heartbeat', [Apicontroller::class, 'botHeartbeat']);
Route::get('/next-stuck-task', [ApiController::class, 'getNextStuckTask']);
