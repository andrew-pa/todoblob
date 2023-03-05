# Todoblob

Live at: https://todoblob.qxczv.pw!

![screenshot of the app](https://user-images.githubusercontent.com/6148347/222934443-87f51e5e-a3dc-406f-b0ac-5a7c62233d13.png)

A todo list/task tracking app using React.js with a Rust/Rocket backend.
Todoblob attempts to model the idea that each task has a day you have assigned to work on it and potentially also a due date.
You can then view only the things you want to do for a particular day or week.
In a sense this is liking having a todo list for each new day, and Todoblob makes it easy to rollover tasks from previous days that you haven't yet completed.
The backend stores a generic JSON object for each user and accepts JSON patches as its primary interface, making it very general, although it shifts almost all logic into the frontend.

