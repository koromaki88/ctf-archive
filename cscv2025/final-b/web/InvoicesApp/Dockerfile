FROM mcr.microsoft.com/dotnet/aspnet:7.0 AS runtime
WORKDIR /app
COPY out/ ./
ENV ASPNETCORE_URLS=http://+:5050
EXPOSE 5050
ENTRYPOINT ["dotnet", "InvoicesApp.dll"]