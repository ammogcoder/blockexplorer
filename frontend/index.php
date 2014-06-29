<?php

#error_reporting(E_ALL);
#ini_set('display_errors', '1');

# proxy script for local testing
$url = 'http://92.222.0.105:8000';
$uri = $_SERVER['REQUEST_URI'];

// Create a stream
$options = array(
	'http'=>array(
		'method'=>"GET",
		'header'=> ""
  )
);

$context = stream_context_create($options);

$content = file_get_contents($url.$uri,FALSE,$context);
echo $content;

?>
