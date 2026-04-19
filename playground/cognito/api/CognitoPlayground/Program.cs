using Amazon;
using Amazon.CognitoIdentityProvider;
using Amazon.CognitoIdentityProvider.Model;
using Amazon.Runtime;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();


// -- Authentication section
string? region = builder.Configuration["Cognito:Region"];
string? userPoolId = builder.Configuration["Cognito:UserPoolId"];
string authority = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authority;
        options.TokenValidationParameters = new()
        {
            ValidIssuer = authority,
            // Cognito access tokens do not carry an `aud` claim; the client ID
            // appears in the `client_id` claim instead, so audience validation
            // must be disabled when accepting access tokens as Bearer credentials.
            ValidateAudience = false,
        };
    });

builder.Services.AddAuthorization();
// -- End of authentication section

string[] allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

string[] summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.MapGet("/me", async (HttpContext httpContext) =>
{
    string token = httpContext.Request.Headers.Authorization.ToString()["Bearer ".Length..];

    using var cognitoClient = new AmazonCognitoIdentityProviderClient(
        new AnonymousAWSCredentials(),
        RegionEndpoint.GetBySystemName(region!));

    GetUserResponse userResponse = await cognitoClient.GetUserAsync(
        new GetUserRequest { AccessToken = token },
        httpContext.RequestAborted);

    return userResponse.UserAttributes.ToDictionary(a => a.Name, a => a.Value);
})
.RequireAuthorization();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
