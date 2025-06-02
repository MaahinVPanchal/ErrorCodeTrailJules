module.exports = function setStartupOptions(server) {

    console.log("Setting startup options for API server...");
    // Disable email validation/requirement for user
    delete server.models.user.validations.email;
    delete server.models.user.validations.username;
};