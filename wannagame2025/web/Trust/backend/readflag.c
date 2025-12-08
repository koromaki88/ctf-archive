#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>

int main() {
    FILE *fp;
    char flag[256];

    setuid(geteuid());

    fp = fopen("/flag.txt", "r");
    if (fp == NULL) {
        printf("Error: Unable to read flag file\n");
        return 1;
    }
    if (fgets(flag, sizeof(flag), fp) != NULL) {
        printf("%s", flag);
    } else {
        printf("Error: Flag file is empty\n");
    }

    fclose(fp);
    return 0;
}
