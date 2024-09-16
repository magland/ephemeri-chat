# ephemeri-chat

## Hosting the server

This server is designed to run on Heroku.

**Step 1: Create a new Heroku project**

Sign up for a [Heroku](https://heroku.com) account and Create a new app. Name it something like `ephemeri-chat-1`.

**Step 2: Set system public/private keys**

Obtain a public/private key pair using the test-ephemeri-chat app.

In the Heroku web console, open the Settings for your project and add two configuration variables: SYSTEM_PUBLIC_KEY and SYSTEM_PRIVATE_KEY.

**Step 3: Clone and set up this repo**

Follow the instructions in the Heroku web console to install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and log in to Heroku from your computer. Then clone and set up this repo.

```bash
heroku login

git clone <this-repo>
cd ephemeri-chat

# replace with the name of your project
heroku git:remote -a ephemeri-chat-1
```

To deploy the server:

```bash
git push heroku main
```

Make a note of the URL where the server is being hosted. For example it might be `https://ephemeri-chat-1.herokuapp.com`. This URL along with the proxy secret will allow clients to connect to services.